const puppeteer = require('puppeteer');
const cookie_arr = require('./my_cookie.js');
const http = require('http');
const LineByLineReader = require('line-by-line');
const _ = require('lodash');
const exec = require('child_process').exec;
const cheerio = require('cheerio');

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

let article_mp3_map = {};

const get_article_mp3 = (page) => {
    return new Promise(async (resolve,reject) => {
        const url_list_reader = new LineByLineReader('article_url_list');

        page.on('response', (res) => {
            if (res.request().url().indexOf('mp3-8-1') >= 0) {
                let mp3_url = res.request().url();
                let start_pos = mp3_url.indexOf('mp3-8-1-');
                start_pos += 'mp3-8-1-'.length;
                let end_pos = mp3_url.indexOf('.mp3?');
                let mp3_id = mp3_url.substring(start_pos,end_pos);
                //console.log(mp3_url)
                console.log(mp3_id)
                article_mp3_map[mp3_id] = mp3_url;
            }
        });

        url_list_reader.on('line', async (line) => {
			url_list_reader.pause();

            let retry_times = 0;

            while (retry_times < 5) {
                try {
                    await page.goto(line, {waitUntil: 'load', timeout: 15000});
                    await sleep(3 * 1000);
                    break;
                } catch (err) {
                    console.log('Error: '+err.message);
                    await sleep(3 * 1000);
                    retry_times += 1;
                    if (retry_times >= 5) {
                        break;
                    }
                    continue;
                }
            }

            let fetch_timeout = false;
            let write_mp3_finish = false;

            await Promise.race([
                new Promise(async (resolve,reject) => {
                    let start_pos = line.indexOf('?xml=news');
                    start_pos += '?xml=news'.length;
                    start_pos = line.indexOf('-', start_pos) + 1;

                    let end_pos = line.indexOf('v2.xml');
                    let article_id = line.substring(start_pos, end_pos);
                    //console.log(article_id)
                    while (!fetch_timeout) {
                        if (article_mp3_map[article_id] !== undefined) {
                            let cmd = "wget '" + article_mp3_map[article_id] + "' -O mp3_data/" + article_id + '.mp3';
                            //console.log(cmd);
                            await new Promise((resolve, reject) => {
                                exec(cmd, (error, stdout, stderr) => {
                                    if (error) {
                                        console.log(error);
                                    }
                                    write_mp3_finish = true;
                                    //console.log(cmd + ' finish');
                                    return resolve(true);
                                });
                            });
                            return resolve(true);
                        }
                        await sleep(1000);
                    }
                    return resolve(true);
                }),
                new Promise((resolve,reject) => {
                    setTimeout(() => {
                        fetch_timeout = true;
                        if (!write_mp3_finish) {
                            //console.log(line.trim() + ' get mp3 fail');
                            console.log(line.trim());
                        }
                        return resolve(false);
                    },20 * 1000);
                })
            ]);
            await sleep(10000);
            url_list_reader.resume();
        });

        url_list_reader.on('error', async (err) => {
            return reject(err);
        });

        url_list_reader.on('end', async () => {
            return resolve(true);
        });
    });
}

(async () => {
    try {
        //const browser = await puppeteer.launch({headless:false});
        const browser = await puppeteer.launch({headless:true});
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36")

        await page.setCookie(...cookie_arr);

        await get_article_mp3(page);

    } catch (err) {
        console.log(err.stack);
        process.exit(-1);
    }
})();
