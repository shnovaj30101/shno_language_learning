const puppeteer = require('puppeteer');
const cookie_arr = require('./my_cookie.js');
const http = require('http');


const sleep = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

(async () => {
    try {
        const browser = await puppeteer.launch({headless:false});
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36")

        //await page.setCookie(...cookie_arr);

        //let article_id = 18277;
        let article_id = 18486;

        await page.setRequestInterception(true);

        page.on('dialog', (dialog) => {
            dialog.dismiss();

        });

        page.on('request', interceptedRequest => {

            let data;
            data = {
                'method': 'POST',
                'postData': 'search_id=' + article_id.toString()
            };
            interceptedRequest.continue(data);
        });


        page.setExtraHTTPHeaders({"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"});

        while (article_id > 0) {
            await page.goto('https://funday.asia/Self-Study/search_id.asp');
            let res_content = await page.content();
            let pat_start_pos = res_content.indexOf('xml=');
            let pat_end_pos = res_content.indexOf('.xml');
            pat_end_pos += 4;
            let article_url = 'https://funday.asia/link.asp?' + res_content.substring(pat_start_pos, pat_end_pos) + '&newpage=news';
            console.log(article_url);
            article_id -= 1;
        }


        await sleep(3000);
    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    }
})();
