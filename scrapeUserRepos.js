const puppeteer = require('puppeteer');

const scrapeUserRepos = async (url) => { 
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();
    await page.goto(url+'?tab=repositories&q=&type=source&language=&sort=stargazers');
    await page.waitForSelector('.col-10.col-lg-9.d-inline-block');
    const repos = await page.$$('.col-10.col-lg-9.d-inline-block');
    for await (const repo of repos) { 
        const starElement = await repo.$('.f6.color-fg-muted.mt-2 > a');
        // console.log(starElement)
        if (starElement) { 
            const starCount = await page.evaluate(e => e.innerText, starElement) || '0';
            // const starCount = await repo.$eval('.f6.color-fg-muted.mt-2 > a', e => e.innerText);
            console.log(starCount)
        }
    }

    
    
}


scrapeUserRepos('https://github.com/boristopalov')