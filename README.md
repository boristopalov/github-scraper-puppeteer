## Github Follow Scraper

Simple javascript bot usig puppeteer. Scrapes a user's following list. 

### Running 
Open up a terminal and run `node index.js` in the project root directory. 

### Issues
Currently, the bot can scrape 40 pages (2000 data points of data) until it stops working. This issue does not seem to be related to API limits as the bot works fine if you re-run it immediately. My guess is that Github detects the bot and blocks it after it makes enough requests.
