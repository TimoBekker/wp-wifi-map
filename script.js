ymaps.ready(init);

function init() {
  var map = new ymaps.Map("map", {
    center: [53.1955, 50.1187],
    zoom: 10
  });

  fetch('address.json')
    .then(response => response.json())
    .then(data => {
      const groupedPoints = {};

      data.forEach(point => {
        let coordsStr = point.координаты.trim();
        let coordsArr = coordsStr.split(/[\s,]+/);
        if (coordsArr.length >= 2) {
          let latitude = parseFloat(coordsArr[0]);
          let longitude = parseFloat(coordsArr[1]);
          if (!isNaN(latitude) && !isNaN(longitude)) {
            const key = `${latitude}_${longitude}`;
            if (!groupedPoints[key]) {
              groupedPoints[key] = {
                coords: [latitude, longitude],
                points: []
              };
            }
            groupedPoints[key].points.push(point);
          }
        }
      });

      const geoObjects = [];
      let activeBalloon = null;

      Object.values(groupedPoints).forEach(group => {
        const [latitude, longitude] = group.coords;

        let balloonContent = '';

        if (group.points.length === 1) {
          // Одна точка - балун с кнопкой "Копировать координаты"
          const p = group.points[0];
          balloonContent = `
            <div class="custom-balloon">
              <h2>Дом.РУ</h2>
              <p>Публичная точка доступа №${p.номер}</p>
              <p>${p.адрес}</p>
              <p>Координаты: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}</p>
              <button class="copy-button" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Копировать координаты</button>
            </div>
          `;
        } else {
          // Несколько точек - список и одна кнопка снизу
          balloonContent = `
            <div class="custom-balloon">
              <h2>Дом.РУ</h2>
              <p>Публичные точки доступа:</p>
              <ul>
                ${group.points.map(p => `
                  <li>
                    №${p.номер} — ${p.адрес}<br/>
                    Координаты: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}
                  </li>
                `).join('')}
              </ul>
              <button class="copy-button" data-coords="${latitude.toFixed(6)}, ${longitude.toFixed(6)}">Копировать координаты</button>
            </div>
          `;
        }

        const placemark = new ymaps.Placemark([latitude, longitude], {
          balloonContent: balloonContent
        }, {
          iconLayout: 'default#image',
          iconImageHref: 'wifi_icon.png',
          iconImageSize: [30, 30],
          iconImageOffset: [-15, -15]
        });

        const radiusCircle = new ymaps.Circle([
          [latitude, longitude],
          50
        ], {}, {
          fillColor: 'rgba(0, 123, 255, 0.2)',
          strokeColor: '#007bff',
          strokeOpacity: 0.6,
          strokeWidth: 2,
          cursor: 'default',
          interactive: false
        });

        map.geoObjects.add(radiusCircle);
        map.geoObjects.add(placemark);

        placemark.events.add('mouseenter', () => {
          if (activeBalloon && activeBalloon !== placemark) {
            activeBalloon.balloon.close();
          }
          placemark.balloon.open();
          activeBalloon = placemark;

          // Обработка кнопки копирования
          setTimeout(() => {
            const btn = document.querySelector('.copy-button');
            if (btn) {
              btn.onclick = () => {
                const coordsText = btn.getAttribute('data-coords');
                copyToClipboard(coordsText);
              };
            }
          }, 0);
        });

        geoObjects.push(placemark);
      });

      const clusterer = new ymaps.Clusterer();
      clusterer.add(geoObjects);
      map.geoObjects.add(clusterer);
    });

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Координаты скопированы: ' + text);
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
      alert('Координаты скопированы: ' + text);
    } catch (err) {
      alert('Ошибка копирования');
    }
    document.body.removeChild(textarea);
  }
}