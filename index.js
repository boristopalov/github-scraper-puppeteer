const puppeteer = require('puppeteer');
const fs = require('fs');
const utils = require('./utils');

const scrape = async (url, callback) => {
    let data = [];
    let pageCount = 1;

    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url);
    while (true) {
        const users = await page.$$('.d-table-cell.col-9.v-align-top.pr-3');
        for await (const user of users) { 
            let userData =  {

            }
            // name is always displayed; if there is no name a blank element is displayed
            const name = (await user.$('.f4.Link--primary'));
            const nameText = await (await name.getProperty('textContent')).jsonValue();
            userData['name'] = nameText !== '' ? await nameText: 'n/a';

            // username is always displayed
            const username = (await user.$('.Link--secondary'));
            const usernameText = await (await username.getProperty('textContent')).jsonValue();
            userData['username'] = await usernameText;
            const email = await utils.searchCommitsForEmail(`https://api.github.com/users/${usernameText}/events/public`);
            userData['email'] = email;


            // not always displayed -- the below element doesn't exist if there is no work info for a user
            // therefore we have to check if it exists
            const work = (await user.$('p.color-fg-muted.text-small.mb-0 > span'));
            let workText = work ? await (await work.getProperty('textContent')).jsonValue() : 'n/a';
            workText = await workText.trim();
            let workArr = workText.split(/\s+/);
            workText = workArr.join(' ');
            userData['company'] = await workText;

            // location not always displayed 
            const location = await user.$('p.color-fg-muted.text-small.mb-0');
            let locationText = location ? await (await location.getProperty('textContent')).jsonValue() : 'n/a';
            locationText = await locationText.trim();
            let locationArr = locationText.split(/\s+/);

            // work-around to get rid of work text, sometimes the data retrieval is iffy
            locationArr = locationArr.filter(e => !workArr.includes(e));
            locationText = locationArr.length ? locationArr.join(' ') : 'n/a';
            userData['location'] = await locationText.toLowerCase();
        
            // bio not always displayed
            const bio = await user.$('.color-fg-muted.text-small.mb-2');
            let bioText = bio ? await (await bio.getProperty('textContent')).jsonValue(): 'n/a';
            bioText = await bioText.trim().toLowerCase();
            userData['bio'] = await bioText;

            data.push(userData);
        };
        console.log("Page scraped: ", pageCount++);
        const paginationContainer = await page.$('.pagination');

        // check if we are on the the last page
        if (!paginationContainer || !nextButton[0]) { 
            console.log("No more pages to scrape! Exiting...")
            break;
        }

        const nextButtonXpath = "a[contains(text(),'Next')]";
        let nextButton = await paginationContainer.$x(nextButtonXpath);
        await nextButton[0].click();
        await page.waitForNavigation();
    };

    callback(data);
    await browser.close();
};


(async () => { 
    const DATAFILE = './data/data.csv';
    const JSONFILE = './data/data.json';
    const url = 'https://github.com/johnrjj?tab=following';

    // scraper stops working after 40 pages (2000 data points) due to github bot detection. have yet to find a solution 
    // if you want to scrape >40 pages you have to manually change the page url and re-run
    // i.e. scrape('https://github.com/mikedemarais?tab=following') runs for 40 pages -> re-run with scrape('https://github.com/mikedemarais?page=41&tab=following')
    await scrape(url, (data) => {

        // save data to JSON file  
        let jsonStream = fs.createWriteStream(JSONFILE, {flags: 'a'});
        jsonStream.write(JSON.stringify(data));
        jsonStream.end();
        
        // convert data to csv-formatted string and save it to a .csv file 
        let dataStream = fs.createWriteStream(DATAFILE, {flags: 'a'});
        const csvString = utils.arrayOfObjectsToCSV(data);
        dataStream.write(csvString);
        dataStream.end();

    }); 

    // didn't use these
    // const keywords = ['web3', 'solidity', 'blockchain', 'crypto', 'ether', 'eth', 'ethereum', 'chain', 'smart contract', 'defi'];
    // const locations = ['nyc', 'new york', 'ny', 'new york city']
    // const bioFilteredData = await utils.getFilteredBio(userFollowingData, keywords);
    // const locationFilteredData = await utils.getFilteredLocation(userFollowingData, locations);
    
})();

