"""Bhavcopy loading and the command line."""
import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from trade_desk import bhavcopy
from trade_desk.cli import main

UDIFF = """TradDt,BizDt,Sgmt,Src,FinInstrmTp,FinInstrmId,ISIN,TckrSymb,SctySrs,XpryDt,FininstrmActlXpryDt,StrkPric,OptnTp,FinInstrmNm,OpnPric,HghPric,LwPric,ClsPric,LastPric,PrvsClsgPric,UndrlygPric,SttlmPric,OpnIntrst,ChngInOpnIntrst,TtlTradgVol
{d},{d},CM,NSE,STK,1,IN1,TRENT,EQ,,,,,TRENT,100,110,95,105,105,100,,105,,,5000
{d},{d},CM,NSE,STK,2,IN2,TRENT,BE,,,,,TRENT,1,1,1,1,1,1,,1,,,10
{d},{d},CM,NSE,STK,3,IN3,GOLDBOND,GB,,,,,GB,50,50,50,50,50,50,,50,,,1
"""
FULL = """SYMBOL, SERIES, DATE1, PREV_CLOSE, OPEN_PRICE, HIGH_PRICE, LOW_PRICE, LAST_PRICE, CLOSE_PRICE, AVG_PRICE, TTL_TRD_QNTY, TURNOVER_LACS, NO_OF_TRADES, DELIV_QTY, DELIV_PER
TRENT, EQ, {d}, 100, 100, 110, 95, 105, 105, 103, 5000, 5, 10, 100, 20
"""


def run(*argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        code = main(list(argv))
    return code, out.getvalue(), err.getvalue()


class Bhavcopy(unittest.TestCase):
    def test_both_formats_and_sorting(self):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / "b.csv").write_text(UDIFF.format(d="2026-07-02"))
            (d / "a.csv").write_text(FULL.format(d="01-Jul-2026"))
            hist = bhavcopy.build_history([d / "b.csv", d / "a.csv"])
            self.assertEqual(list(hist), ["TRENT"])  # EQ only: the BE row and the bond are dropped
            self.assertEqual([b["date"] for b in hist["TRENT"]], ["2026-07-01", "2026-07-02"])
            self.assertEqual(hist["TRENT"][1]["c"], 105.0)
            s = bhavcopy.to_series(hist["TRENT"])
            self.assertEqual((s.h, s.l), ([110.0, 110.0], [95.0, 95.0]))

    def test_wrong_file_is_refused(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "x.csv"
            p.write_text("A,B\n1,2\n")
            with self.assertRaises(ValueError):
                bhavcopy.read_file(p)


class Cli(unittest.TestCase):
    def test_picks(self):
        code, out, _ = run("picks")
        self.assertEqual(code, 0)
        for text in ("Qty 33 at ₹5,00,000 capital and 1% risk", "Qty 111", "Trailing stop 8% below ₹2,454.00 = ₹2,257.68", "Trailing stop 3% below ₹1,836.80 = ₹1,781.70"):
            self.assertIn(text, out)

    def test_risk_flag_changes_the_size(self):
        self.assertIn("Qty 66 at", run("picks", "--risk", "2")[1])

    def test_size(self):
        code, out, _ = run("size", "--entry", "2470", "--stop", "2320", "--t1", "2770", "--t2", "2920")
        self.assertEqual(code, 0)
        self.assertIn("Quantity 33", out)
        self.assertEqual(run("size", "--entry", "100", "--stop", "120", "--t1", "130", "--t2", "140")[0], 2)

    def test_patterns_table(self):
        code, out, _ = run("patterns", "--symbols", "SAILIFE", "TRENT", "LAURUSLABS")
        self.assertEqual(code, 0)
        self.assertIn("SAILIFE", out)
        self.assertIn("Inverse head and shoulders", out)
        code, _, err = run("patterns", "--symbols", "NOSUCH")
        self.assertIn("no price history", err)

    def test_note(self):
        code, out, _ = run("note", "LAURUSLABS")
        self.assertEqual(code, 0)
        self.assertIn("type: minervini-sepa-setup", out)
        self.assertIn("rsi_14: 75.0", out)
        self.assertIn("ema_20: 2214.39", out)
        self.assertEqual(run("note", "NOSUCH")[0], 2)

    def test_tracker_round_trip(self):
        with tempfile.TemporaryDirectory() as d:
            st = str(Path(d) / "pos.json")
            self.assertEqual(run("track", "show", "--state", st)[0], 2)
            self.assertEqual(run("track", "open", "intra", "--fill", "1900", "--qty", "50", "--state", st)[0], 0)
            code, out, _ = run("track", "update", "intra", "--price", "1975", "--high", "1980", "--low", "1940", "--on", "2026-11-12", "--state", st)
            self.assertEqual(code, 0)
            self.assertIn("1,920.60", out)
            self.assertIn("Stop raised", out)
            code, out, _ = run("track", "update", "intra", "--price", "1915", "--low", "1910", "--on", "2026-11-13", "--state", st)
            self.assertIn("HIT", out)
            self.assertEqual(run("track", "close", "intra", "--state", st)[0], 0)
            self.assertEqual(run("track", "show", "--state", st)[0], 2)


if __name__ == "__main__":
    unittest.main()
