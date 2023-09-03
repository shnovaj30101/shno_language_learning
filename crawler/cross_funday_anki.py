import json

anki_word_set = set()

with open('anki/anki_result_file', 'rt') as rf:
    for line in rf:
        line = line.strip()
        if len(line) == 0:
            continue

        data = json.loads(line)
        word_list = data['word_list']['value'].split(',')
        for word in word_list:
            anki_word_set.add(word)
    

with open('funday/article_file', 'rt') as rf:
    for line in rf:
        line = line.strip()
        if len(line) == 0:
            continue

        data = json.loads(line)


        if 'article' in data:
            output_json = {
                'article_id': data['article_id'],
                'title': data['trans_title'],
                'rank': data['rank'],
            }
            match_word_set = set()

            word_list = data['article'].split()

            for word in word_list:
                if word.lower().strip('.,?!') in anki_word_set:
                    match_word_set.add(word.lower().strip('.,?!'))

            if len(match_word_set) > 0:
                output_json['match_word'] = list(match_word_set)
                print(json.dumps(output_json, ensure_ascii=False))


