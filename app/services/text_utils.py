import unicodedata


def fold_latin_accents(text: str) -> str:
    """Fold Latin diacritics (e.g. 'Latté' -> 'Latte') without altering non-Latin scripts."""
    if not text:
        return ""
    out = []
    skip_combining = False
    for ch in unicodedata.normalize("NFKD", text):
        if unicodedata.combining(ch):
            if skip_combining:
                continue
            out.append(ch)
        else:
            skip_combining = "LATIN" in unicodedata.name(ch, "")
            out.append(ch)
    return unicodedata.normalize("NFC", "".join(out))
