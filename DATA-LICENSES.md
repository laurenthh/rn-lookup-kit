# Bundled data

The code is MIT (`LICENSE`). The tables it ships are derived from these
sources; each is public domain or equivalent, so redistribution here needs no
permission. Rebuild scripts live in `scripts/`.

| Table | Source | Licence | Pin |
|---|---|---|---|
| `src/food/foods.json` | [USDA FoodData Central](https://fdc.nal.usda.gov/) — Foundation Foods and SR Legacy CSVs, plus curated portions in `scripts/foods-curated.ts` | Public domain (U.S. Government work, published under CC0 1.0) | CSV release unpacked in `.cache/fdc/` at build time |
| `src/places/airports.json` | [OurAirports](https://ourairports.com/data/) `airports.csv` | Public domain (as stated on ourairports.com/data) | 2026-10-03, 86,158 rows, sha256 `ff5143921ef72d767402c299a5d868f79166c5c589267aca13dce957c41bd2a2` |
| `src/exercise/exercises.json` | [free-exercise-db](https://github.com/yuhonas/free-exercise-db) `dist/exercises.json`, plus curated entries in `scripts/exercises-curated.ts` | [The Unlicense](https://github.com/yuhonas/free-exercise-db/blob/main/LICENSE) | commit `f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5` |

Exercise photos are not bundled: the lookup returns a jsDelivr URL into the
same pinned free-exercise-db commit, and the app downloads it.

The test corpora (`__tests__/fixtures/`) are written for this project and
fall under the MIT licence with the code.
