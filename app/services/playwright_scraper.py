from playwright.sync_api import sync_playwright
import logging
import re

logger = logging.getLogger(__name__)

def scrape_cafe_site(url: str, search_term: str = "espresso soda") -> dict:
    """
    Visits a cafe website to search for keywords related to the search_term
    and attempts to extract any daily specials.
    Returns: {"has_drink": bool, "special_desc": str}
    """
    result = {"has_drink": False, "special_desc": None}
    
    if not url:
        return result
    
    # Simple URL format enforcement
    if not url.startswith("http"):
        url = "http://" + url
        
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            
            # Go to site with a timeout and wait until network is mostly idle
            page.goto(url, timeout=15000, wait_until="domcontentloaded")
            
            # Get text context of the page body
            content = page.locator("body").inner_text().lower()
            
            # 1. Search for user's favorite drink
            # Create a regex allowing for optional spaces or plural variations (naive)
            drink_regex = re.compile(re.escape(search_term), re.IGNORECASE)
            if drink_regex.search(content):
                result["has_drink"] = True
                
            # 2. Heuristic extraction of 'specials' (naive approach for MVP)
            # Find a line containing "special" and extract a tiny snippet around it
            lines = content.split('\n')
            for i, line in enumerate(lines):
                if "special" in line or "today only" in line:
                    # Look ahead a few lines to capture context
                    context_lines = lines[i:min(i+3, len(lines))]
                    clean_special = " ".join([l.strip() for l in context_lines if l.strip()])
                    # Truncate to avoid giant blocks of text
                    result["special_desc"] = clean_special[:100] + ("..." if len(clean_special) > 100 else "")
                    break
            
            browser.close()
            
    except Exception as e:
        logger.warning(f"Failed to scrape {url}: {e}")
        
    return result

if __name__ == "__main__":
    # Test (replace with an actual cafe site later)
    print(scrape_cafe_site("https://example.com", "espresso soda"))
