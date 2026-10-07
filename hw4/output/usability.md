# Problem 9 - Usability Improvements

## Front-end
- Collapsible chat results: Search results from the chat appear in a "From the chat"
  section at the top of the page, which took up a lot of space. It can now collapse to a
  one-line strip of small thumbnails with a count ("8 items from the chat"), so the rest
  of the page stays usable. It starts expanded, and every new search re-opens it so new
  results are never hidden.
- Products page filters: With 102 products in one long grid, browsing was hard. The page
  now has category chips (Hoodies, Quarter zips, Crewnecks, Tees and long sleeves,
  Jackets and fleece) with item counts, a search box, and sorting by name or price. The
  filters are kept in the page URL, so refreshing or going back from a product keeps them.

## Back-end
- Tags no longer create false matches: Asking about hats showed the "District Vit Hoodie
  Vintage Sailor Bulldog", because its search tags include "sailor hat" (for the graphic
  on the hoodie). In tools.py, a product now only matches if the search words appear in
  its name, garment type, or primary color; tags only help rank products that already
  match. Result: "hats" returns nothing and the agent says we don't carry hats, while
  "hoodie" still returns all 27 hoodies. Side benefit: "crewneck" dropped from 38 to 30
  results, because tees tagged "crew neck" stopped counting as crewnecks.
- Color searches match the main color: Searching for navy returned a gray crewneck with
  navy lettering, because the colors list includes every color on an item. The search now
  only matches a color against the product's primary color (the first one listed). Result:
  "navy" went from 80 to 44 results, all mainly navy, and "navy crewneck" from 25 to 11.
  Note: the Products page search box is still broader (it searches all colors and
  descriptions), so "navy" there also finds items with navy details.