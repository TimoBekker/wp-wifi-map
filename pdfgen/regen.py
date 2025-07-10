import json

input_filename = 'address.json'
output_filename = 'address_updated.json'

with open(input_filename, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Перебираем все записи и присваиваем номера по порядку
for idx, item in enumerate(data, start=1):
    item['номер'] = idx

with open(output_filename, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)

print(f"Обработка завершена. Нумерация обновлена и сохранена в {output_filename}")