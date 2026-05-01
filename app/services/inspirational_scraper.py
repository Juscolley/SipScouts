import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

def fetch_daily_quote():
    """
    Scrapes the daily quote from inspiringquotes.com.
    Returns a dict with 'quote' and 'author', or a default fallback if it fails.
    """
    url = "https://www.inspiringquotes.com/"
    
    # Use a standard user agent to avoid being blocked by simple bot protection
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()

        soup = BeautifulSoup(response.text, 'html.parser')
        
        # The structure of inspiringquotes.com often has the quote in an h1 or specific div.
        # This selector targets the typical layout as of 2024/2025.
        
        # Looking for the main quote text
        quote_element = soup.select_one('.quote-text') or soup.select_one('h1')
        author_element = soup.select_one('.quote-author') or soup.select_one('.author-name')

        if quote_element and author_element:
            quote = quote_element.get_text(strip=True)
            # Remove any surrounding quotes if they exist in the raw text
            if quote.startswith('"') and quote.endswith('"'):
                quote = quote[1:-1]
            
            author = author_element.get_text(strip=True)
            
            return {
                "quote": quote,
                "author": author
            }
        else:
            logger.warning("Could not find quote or author elements on the page. Using fallback.")
            return get_fallback_quote()

    except Exception as e:
        logger.error(f"Error fetching quote: {e}")
        return get_fallback_quote()

def get_fallback_quote():
    return {
        "quote": "Every morning starts a new page in your story. Make it a great one today.",
        "author": "Doe Zantamata"
    }

if __name__ == "__main__":
    print(fetch_daily_quote())
