from playwright.sync_api import sync_playwright
import time

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        # Listen for console logs
        def on_console(msg):
            print(f"CONSOLE: {msg.text}")
            
        def on_page_error(err):
            print(f"PAGE ERROR: {err}")
            
        page.on("console", on_console)
        page.on("pageerror", on_page_error)
        
        print("Navigating to localhost:8081...")
        page.goto("http://localhost:8081")
        time.sleep(1)
        
        print("Clicking 'The Circuit'...")
        page.evaluate("document.querySelector('.track-btn').click()")
        
        time.sleep(3)
        print("Done.")
        browser.close()

if __name__ == "__main__":
    run()
