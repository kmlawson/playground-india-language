#!/bin/sh
# Download the large inputs that are not kept in the repository.
# Uses a descriptive user-agent with no personal information.
set -e
cd "$(dirname "$0")/../source"
UA="india-languages-census-map/1.0 (static site build)"
# 1. The census scan (Internet Archive) — page images for checking the transcription.
ia download india.history.resource.92539 --glob="92539_jp2.zip" --no-directories
# 2. Boundaries
mkdir -p geo && cd geo
for c in PAK IND BGD; do
  curl -sL -A "$UA" "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/$c/ADM2/geoBoundaries-$c-ADM2_simplified.geojson" -o $c-ADM2.geojson
done
curl -sL -A "$UA" https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip -o ne_10m_land.zip
curl -sL -A "$UA" https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_0_countries.zip -o ne_10m_admin_0_countries.zip
curl -sL -A "$UA" https://naciscdn.org/naturalearth/10m/cultural/ne_10m_admin_1_states_provinces.zip -o ne_10m_admin_1_states_provinces.zip
for z in ne_*.zip; do unzip -o -q "$z" -d "${z%.zip}"; done
# plague_india shapefiles are committed (source/geo/plague_india, LGPL-3.0);
# original: https://github.com/wtennant/plague_india/tree/master/Data/Shapefiles
