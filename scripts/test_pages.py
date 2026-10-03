#!/usr/bin/env python3
"""Drives every built page in headless Chromium.

Catches the class of breakage that static validation cannot: a page that
renders but whose gallery filter hides everything, a lightbox that will not
close, a form that reports no errors on an empty submit. Serves the repo over
HTTP (not file://) so relative paths behave exactly as they do on GitHub Pages.

  python3 scripts/test_pages.py            run the suite
  python3 scripts/test_pages.py --shots    also write screenshots/ for review

Requires: pip install playwright && python -m playwright install chromium
"""
import functools, glob, http.server, json, os, socketserver, sys, threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)

SHOTS = "--shots" in sys.argv

# Chromium has no route to the webfont CDN in a sandboxed CI job, and the font
# is a progressive enhancement, so a failed request for it is not a test
# failure. Anything served from our own origin must load cleanly.
EXTERNAL_HOSTS = ("fonts.googleapis.com", "fonts.gstatic.com", "googletagmanager.com")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def serve():
    socketserver.TCPServer.allow_reuse_address = True
    handler = functools.partial(QuietHandler, directory=ROOT)
    httpd = socketserver.TCPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    return httpd, "http://127.0.0.1:%d" % httpd.server_address[1]


def launch(pw):
    """Use the bundled browser, or the one this image already ships."""
    try:
        return pw.chromium.launch()
    except Exception:
        return pw.chromium.launch(executable_path="/opt/pw-browsers/chromium")


class Results:
    def __init__(self):
        self.failures = []
        self.checks = 0

    def check(self, label, condition, detail=""):
        self.checks += 1
        if not condition:
            self.failures.append("%s%s" % (label, (": " + detail) if detail else ""))
        return condition


def page_paths():
    paths = []
    for meta in sorted(glob.glob("src/pages/*.json")):
        with open(meta, encoding="utf-8") as f:
            paths.append(json.load(f)["file"])
    return paths


def attach_log(page, errors):
    page.on("pageerror", lambda e: errors.append("uncaught: %s" % e))

    def on_console(msg):
        if msg.type != "error":
            return
        # A failed subresource logs only "Failed to load resource: <reason>",
        # with the URL in the message location rather than the text, so the
        # origin has to be read from there.
        where = (msg.location or {}).get("url", "")
        if any(h in where or h in msg.text for h in EXTERNAL_HOSTS):
            return
        errors.append("console: %s (%s)" % (msg.text, where or "no url"))

    page.on("console", on_console)


def scroll_through(page):
    """Walk the page top to bottom so every reveal observer has fired."""
    # behavior:'instant' matters: the stylesheet sets scroll-behavior:smooth,
    # and a plain scrollTo would animate towards a target this loop keeps
    # moving, so the page would never actually traverse and most observers
    # would never fire.
    page.evaluate("""() => new Promise(resolve => {
        const step = Math.round(window.innerHeight * 0.8);
        let y = 0;
        const tick = () => {
            window.scrollTo({ top: y, behavior: 'instant' });
            y += step;
            if (y < document.documentElement.scrollHeight) {
                setTimeout(tick, 70);
            } else {
                setTimeout(() => {
                    window.scrollTo({ top: 0, behavior: 'instant' });
                    setTimeout(resolve, 900);
                }, 200);
            }
        };
        tick();
    })""")


def main():
    from playwright.sync_api import sync_playwright

    httpd, base = serve()
    r = Results()
    try:
        with sync_playwright() as pw:
            browser = launch(pw)
            ctx = browser.new_context(viewport={"width": 1440, "height": 960})

            # ---- every page renders cleanly ----
            for rel in page_paths():
                page = ctx.new_page()
                errors = []
                attach_log(page, errors)
                resp = page.goto("%s/%s" % (base, rel), wait_until="networkidle")
                r.check("%s status" % rel, resp is not None and resp.status == 200,
                        str(resp.status if resp else "no response"))
                r.check("%s has one h1" % rel, page.locator("h1").count() == 1,
                        "found %d" % page.locator("h1").count())
                r.check("%s header present" % rel, page.locator(".site-header").count() == 1)
                r.check("%s footer present" % rel, page.locator(".site-footer").count() == 1)
                r.check("%s no JS errors" % rel, not errors, "; ".join(errors))
                # Reveal elements start hidden and are shown by an observer as
                # they scroll into view. Walk the whole page, then assert that
                # nothing is still invisible - a broken observer would leave
                # entire sections blank and would not show up in any diff.
                scroll_through(page)
                hidden = page.evaluate(
                    "Array.from(document.querySelectorAll('[data-reveal]'))"
                    ".filter(el => getComputedStyle(el).opacity === '0').length")
                r.check("%s reveal elements shown after scrolling" % rel, hidden == 0,
                        "%d still at opacity 0" % hidden)
                if SHOTS:
                    os.makedirs("screenshots", exist_ok=True)
                    page.screenshot(path="screenshots/%s.png" % rel.replace("/", "-"),
                                    full_page=True)
                page.close()

            # ---- gallery filters ----
            page = ctx.new_page()
            errors = []
            attach_log(page, errors)
            page.goto("%s/work.html" % base, wait_until="networkidle")
            total = page.locator(".shot").count()
            r.check("work.html has photographs", total > 0, str(total))
            page.locator('.filter[data-filter="weddings"]').click()
            page.wait_for_timeout(120)
            shown = page.locator(".shot:visible").count()
            weddings = page.locator('.shot[data-collection="weddings"]').count()
            r.check("filter shows only that collection", shown == weddings,
                    "%d shown, %d in collection" % (shown, weddings))
            r.check("filter narrows the gallery", shown < total,
                    "%d of %d" % (shown, total))
            r.check("filter marks itself pressed",
                    page.locator('.filter[data-filter="weddings"]')
                        .get_attribute("aria-pressed") == "true")
            page.locator('.filter[data-filter="all"]').click()
            page.wait_for_timeout(120)
            r.check("clearing the filter restores everything",
                    page.locator(".shot:visible").count() == total)

            # ---- deep link by hash ----
            page.goto("%s/work.html#portraits" % base, wait_until="networkidle")
            page.wait_for_timeout(200)
            r.check("hash deep link applies the filter",
                    page.locator(".shot:visible").count()
                    == page.locator('.shot[data-collection="portraits"]').count())

            # ---- lightbox ----
            page.goto("%s/work.html" % base, wait_until="networkidle")
            first = page.locator(".shot-link").first
            first_src = first.get_attribute("href")
            first.click()
            page.wait_for_timeout(250)
            r.check("lightbox opens", page.locator(".lightbox.is-open").count() == 1)
            r.check("lightbox shows the photograph clicked",
                    (page.locator(".lightbox img").get_attribute("src") or "").endswith(first_src))
            r.check("lightbox traps the page scroll",
                    page.evaluate("document.body.classList.contains('lightbox-open')"))
            page.keyboard.press("ArrowRight")
            page.wait_for_timeout(200)
            r.check("lightbox advances",
                    not (page.locator(".lightbox img").get_attribute("src") or "").endswith(first_src))
            page.keyboard.press("Escape")
            page.wait_for_timeout(300)
            r.check("lightbox closes on Escape",
                    page.locator(".lightbox.is-open").count() == 0)
            r.check("focus returns to the photograph",
                    page.evaluate("document.activeElement.classList.contains('shot-link')"))
            r.check("gallery page stayed clean", not errors, "; ".join(errors))
            page.close()

            # ---- FAQ ----
            page = ctx.new_page()
            errors = []
            attach_log(page, errors)
            page.goto("%s/services.html" % base, wait_until="networkidle")
            q = page.locator(".faq-question").first
            panel_id = q.get_attribute("aria-controls")
            r.check("FAQ starts closed", q.get_attribute("aria-expanded") == "false")
            r.check("FAQ answer starts collapsed",
                    page.evaluate("document.getElementById('%s').getBoundingClientRect().height < 2"
                                  % panel_id))
            q.click()
            page.wait_for_timeout(500)
            r.check("FAQ opens", q.get_attribute("aria-expanded") == "true")
            r.check("FAQ answer becomes readable",
                    page.evaluate("document.getElementById('%s').getBoundingClientRect().height > 20"
                                  % panel_id))
            q.click()
            page.wait_for_timeout(500)
            r.check("FAQ closes again", q.get_attribute("aria-expanded") == "false")
            r.check("services page stayed clean", not errors, "; ".join(errors))
            page.close()

            # ---- enquiry form ----
            page = ctx.new_page()
            errors = []
            attach_log(page, errors)
            page.goto("%s/contact.html" % base, wait_until="networkidle")
            page.locator("#enquiry button[type=submit]").click()
            page.wait_for_timeout(200)
            r.check("empty submit is refused",
                    page.locator(".field.has-error").count() >= 3,
                    "%d fields flagged" % page.locator(".field.has-error").count())
            r.check("the refusal is announced",
                    (page.locator(".form-status").inner_text() or "").strip() != "")
            page.fill("#name", "Anita")
            page.fill("#email", "not-an-email")
            page.fill("#message", "We are getting married in February and need a photographer.")
            page.locator("#enquiry button[type=submit]").click()
            page.wait_for_timeout(200)
            r.check("a bad email is still caught",
                    page.locator("#email").get_attribute("aria-invalid") == "true")
            page.fill("#email", "anita@example.com")
            page.wait_for_timeout(150)
            r.check("fixing the email clears the error",
                    page.locator("#email").get_attribute("aria-invalid") is None)
            # A package link should preselect the occasion.
            page.goto("%s/contact.html?package=portraits" % base, wait_until="networkidle")
            r.check("package link preselects the occasion",
                    page.locator("#occasion").input_value() == "Portrait sitting",
                    page.locator("#occasion").input_value())
            r.check("contact page stayed clean", not errors, "; ".join(errors))
            page.close()
            ctx.close()

            # ---- mobile navigation ----
            m = browser.new_context(viewport={"width": 390, "height": 844},
                                    is_mobile=True, has_touch=True)
            page = m.new_page()
            errors = []
            attach_log(page, errors)
            page.goto("%s/index.html" % base, wait_until="networkidle")
            toggle = page.locator(".nav-toggle")
            r.check("menu button is offered on mobile", toggle.is_visible())
            r.check("nav starts closed", not page.locator("#site-nav a").first.is_visible())
            toggle.click()
            page.wait_for_timeout(400)
            r.check("nav opens", page.locator("#site-nav a").first.is_visible())
            r.check("menu button reports its state",
                    toggle.get_attribute("aria-expanded") == "true")
            page.keyboard.press("Escape")
            page.wait_for_timeout(400)
            r.check("nav closes on Escape",
                    not page.locator("#site-nav a").first.is_visible())
            r.check("no horizontal overflow on a phone",
                    page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"),
                    page.evaluate("document.documentElement.scrollWidth + ' > ' + window.innerWidth"))
            r.check("mobile home stayed clean", not errors, "; ".join(errors))
            if SHOTS:
                os.makedirs("screenshots", exist_ok=True)
                page.screenshot(path="screenshots/mobile-index.png", full_page=True)
            page.close()
            m.close()
            browser.close()
    finally:
        httpd.shutdown()

    if r.failures:
        print("FAILED %d of %d checks:" % (len(r.failures), r.checks))
        for f in r.failures:
            print("   %s" % f)
        return 1
    print("OK: %d browser checks passed." % r.checks)
    return 0


if __name__ == "__main__":
    sys.exit(main())
