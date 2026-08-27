#!/usr/bin/env python3
"""verify_voice.py — compare a candidate text's stylometry JSON to a register target JSON.

Usage: python3 verify_voice.py <candidate.json> <target.json> [--corpus-dir DIR --text FILE]

Checks per references/07-verification.md. Optional Burrows' Delta if
faststylometry is installed and --corpus-dir/--text are given.
"""
import json, sys, argparse

def get(d, *ks):
    for k in ks: d = d[k]
    return d

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("candidate"); ap.add_argument("target")
    ap.add_argument("--corpus-dir"); ap.add_argument("--text")
    a = ap.parse_args()
    c, t = (json.load(open(p)) for p in (a.candidate, a.target))
    checks = [
        ("mean sentence len", get(c,"syntactic","sentence_stats","mean_words"),
         get(t,"syntactic","sentence_stats","mean_words"), 5.0),
        ("em-dash /1000w", get(c,"punctuation","em_dash_per_1000w"),
         get(t,"punctuation","em_dash_per_1000w"), 1.5),
        ("semicolon /1000w", get(c,"punctuation","semicolon_per_1000w"),
         get(t,"punctuation","semicolon_per_1000w"), 1.0),
        ("hedge /100w", get(c,"hedging_booster","hedge_per_100w"),
         get(t,"hedging_booster","hedge_per_100w"), 0.5),
        ("boost /100w", get(c,"hedging_booster","boost_per_100w"),
         get(t,"hedging_booster","boost_per_100w"), 0.3),
        ("concession rate", get(c,"syntactic","concession_rate"),
         get(t,"syntactic","concession_rate"), 0.10),
        ("comma /sentence", get(c,"punctuation","comma_per_sentence"),
         get(t,"punctuation","comma_per_sentence"), 0.6),
    ]
    failed = 0
    for name, cv, tv, tol in checks:
        ok = abs(cv - tv) <= tol
        failed += (not ok)
        print(f"{'PASS' if ok else 'FAIL':4}  {name:20} candidate={cv}  target={tv}  tol=±{tol}")
    # ponytail: optional Burrows' Delta; skipped silently if faststylometry absent
    if a.corpus_dir and a.text:
        try:
            from faststylometry import Corpus, calibrate, predict_proba, tokenise_remove_pronouns_en
            from faststylometry.burrows_delta import calculate_burrows_delta
            from pathlib import Path
            ref, test = Corpus(), Corpus()
            for f in Path(a.corpus_dir).glob("*.txt"):
                ref.add_book("chris", f.stem, f.read_text(errors="ignore"))
            test.add_book("candidate", "draft", Path(a.text).read_text(errors="ignore"))
            ref.tokenise(tokenise_remove_pronouns_en); test.tokenise(tokenise_remove_pronouns_en)
            delta = calculate_burrows_delta(ref, test)
            print(f"\nBurrows' Delta vs corpus: {float(delta.iloc[0,0]):.3f}  (lower = closer)")
        except ImportError:
            print("\n(faststylometry not installed — Delta check skipped: pip install faststylometry)")
    sys.exit(1 if failed else 0)

if __name__ == "__main__":
    main()
