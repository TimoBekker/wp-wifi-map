ymaps.ready(init);

function init() {
  const map = new ymaps.Map("map", {
    center: [53.1955, 50.1187],
    zoom: 9,
    controls: ['zoomControl', 'typeSelector']
  });

  let clusterer = new ymaps.Clusterer({
    clusterMaxZoom: 9,
    clusterDisableClickZoom: false,
    openBalloonOnClick: false
  });

  let geoObjects = [];
  let isClustered = true;

  // Обработка клика по кластеру для зума
  clusterer.events.add('click', (e) => {
    const target = e.get('target');
    if (target instanceof ymaps.Clusterer) {
      const geoObjectsInCluster = target.getGeoObjects();
      if (geoObjectsInCluster.length > 0) {
        const coords = geoObjectsInCluster[0].geometry.getCoordinates();
        const currentZoom = map.getZoom();
        map.setZoom(currentZoom + 1, {
          center: coords,
          duration: 300
        });
      }
    }
  });

  // Функция для получения данных с кешем
  function getCachedData(key, url) {
    return new Promise((resolve, reject) => {
      const cached = localStorage.getItem(key);
      if (cached) {
        try {
          resolve(JSON.parse(cached));
        } catch (e) {
          // Если парсинг не удался, удаляем кеш и загружаем заново
          localStorage.removeItem(key);
          fetchAndCache(key, url).then(resolve).catch(reject);
        }
      } else {
        fetchAndCache(key, url).then(resolve).catch(reject);
      }
    });
  }

  function fetchAndCache(key, url) {
    return fetch(url).then(res => res.json()).then(data => {
      localStorage.setItem(key, JSON.stringify(data));
      return data;
    });
  }

  // Загрузка данных с кешем
  Promise.all([
    getCachedData('address_rt', 'address_rt.json'),
    getCachedData('address_dr', 'address_dr.json')
  ]).then(([dataRT, dataDR]) => {
    const allData = [...dataRT, ...dataDR];

    const groupedPoints = {};

    // Группировка точек по округленным координатам
    allData.forEach(point => {
      let coordsStr = point.координаты.trim();
      let coordsArr = coordsStr.split(/[\s,]+/);
      if (coordsArr.length >= 2) {
        let latitude = parseFloat(coordsArr[0]);
        let longitude = parseFloat(coordsArr[1]);
        if (!isNaN(latitude) && !isNaN(longitude)) {
          const latRounded = latitude.toFixed(6);
          const lonRounded = longitude.toFixed(6);
          const key = `${latRounded}_${lonRounded}`;

          if (!groupedPoints[key]) {
            groupedPoints[key] = {
              coords: [parseFloat(latRounded), parseFloat(lonRounded)],
              points: []
            };
          }
          point.оператор = point.оператор || 'Неизвестный оператор';
          groupedPoints[key].points.push(point);
        }
      }
    });

    if (isClustered) {
      clusterer.removeAll();
    } else {
      map.geoObjects.remove(...geoObjects);
    }
    geoObjects = [];

    Object.values(groupedPoints).forEach(group => {
      const [latitude, longitude] = group.coords;

      let balloonContent = '';

      if (group.points.length === 1) {
        const p = group.points[0];
        balloonContent = `
          <div class="custom-balloon" style="font-family: Arial, sans-serif;">
            <h2>Точка доступа</h2>
            <p>Оператор: <strong>${p.оператор}</strong></p>
            <p>Публичная точка доступа №${p.номер}</p>
            <p>${p.адрес}</p>
            <p>Координаты: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
            <button class="copy-button" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Копировать координаты</button>
            <button class="show-in-yandex" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Показать на Я.Карты</button>
          </div>
        `;
      } else {
        const operatorsMap = {};
        group.points.forEach(p => {
          if (!operatorsMap[p.оператор]) {
            operatorsMap[p.оператор] = [];
          }
          operatorsMap[p.оператор].push(p.номер);
        });

        const address = group.points[0].адрес;

        const operatorsHtml = '<ul style="padding-left: 20px; margin: 0;">' +
          Object.entries(operatorsMap).map(([op, nums]) =>
            `<li style="list-style-type: disc;">${op} №${nums.join(', ')}</li>`
          ).join('') +
          '</ul>';

        balloonContent = `
          <div class="custom-balloon" style="font-family: Arial, sans-serif;">
            <h2>Точки доступа</h2>
            <p>Операторы:</p>
            ${operatorsHtml}
            <p>Адрес: <strong>${address}</strong></p>
            <p>Координаты: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
            <button class="copy-button" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Копировать координаты</button>
            <button class="show-in-yandex" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Показать на Я.Карты</button>
          </div>
        `;
      }

      const placemark = new ymaps.Placemark([latitude, longitude], {
        balloonContent: balloonContent
      }, {
        iconLayout: 'default#image',
        iconImageHref: 'wifi_icon.png',
        iconImageSize: [40, 28],
        iconImageOffset: [-20, -14]
      });

      const radiusCircle = new ymaps.Circle(
        [[latitude, longitude], 20],
        {},
        {
          fillColor: 'rgba(30, 151, 254, 0.2)',
          strokeColor: '#1e97fe',
          strokeOpacity: 0.6,
          strokeWidth: 2,
          cursor: 'default',
          interactive: false
        }
      );

      map.geoObjects.add(radiusCircle);
      map.geoObjects.add(placemark);
      geoObjects.push(placemark);

      placemark.events.add('balloonopen', () => {
        setTimeout(() => {
          // Обработчик для кнопки "Копировать координаты"
          document.querySelectorAll('.copy-button').forEach(btn => {
            btn.onclick = () => {
              const coordsText = btn.getAttribute('data-coords');
              copyToClipboard(coordsText);
            };
          });
          // Обработчик для кнопки "Показать в приложении"
          document.querySelectorAll('.show-in-yandex').forEach(btn => {
            btn.onclick = () => {
              const coordsText = btn.getAttribute('data-coords');
              const [lat, lon] = coordsText.split(', ').map(parseFloat);
              const url = `https://maps.yandex.ru/?ll=${lon},${lat}&z=14&pt=${lon},${lat}&size=auto`;
              window.open(url, '_blank');
            };
          });
        }, 0);
      });
    });

    if (isClustered) {
      clusterer.add(geoObjects);
      map.geoObjects.add(clusterer);
    }
  });

  // Функции копирования
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      // ничего не делаем
    }).catch(() => {
      fallbackCopy(text);
    });
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    //alert('Координаты скопированы');
  } catch (err) {
    alert('Ошибка копирования');
  }
  document.body.removeChild(textarea);
}
}