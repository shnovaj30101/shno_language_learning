const axios = require('axios');
const puppeteer = require('puppeteer');
const LineByLineReader = require('line-by-line');
const fs = require('fs');
const moment = require('moment');

const main = async (args) => {

    let deck_data = {
        "action": "findCards",
        "version": 6,
        "params": {
            "query": args.search_pattern
        }
    }
    let deck_options = {
        method: 'POST',
        url: "http://127.0.0.1:8765",
        timeout: 6*1000,
        data: deck_data,
    };

    let deck_response = await axios(deck_options);

    let card_id_list = deck_response.data.result;

    let card_data = {
        "action": "cardsInfo",
        "version": 6,
        "params": {
            "cards": card_id_list,
        }
    }
    let card_options = {
        method: 'POST',
        url: "http://127.0.0.1:8765",
        timeout: 6*1000,
        data: card_data,
    };

    let response = await axios(card_options);

    for (let item of response.data.result) {
        fs.appendFileSync(args.result_file, JSON.stringify(item.fields)+'\n');
    }
}

(async () => {
    if (require.main !== module) {
        return;
    }

    const parseArgs = require('minimist');
    const _args = parseArgs(
        process.argv.slice(2),
        {
            string: [ 'search_pattern', 'result_file' ],
            alias: {
                s: 'search_pattern',
                r: 'result_file',
            },
            default: {
                search_pattern: '',
                result_file: 'anki_result_file',
            }
        }
    );

    if (_args.search_pattern.length === 0) {
        console.log("search_pattern.length need > 0");
        process.exit(-1);
    }

    await main(_args);
})();
