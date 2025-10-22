ymaps.ready(init);

function init() {
  var map = new ymaps.Map("map", {
    center: [53.341739, 49.468601],
    zoom: 9,
    controls: ['zoomControl', 'typeSelector']
  });

  map.options.set('balloonPanelMaxMapArea', 0);

  Promise.all([
    fetch(wifiMapData.addressRT).then(res => res.json()).then(data => data.map(p => ({...p, sourceFile: 'address_rt.json'}))),
    fetch(wifiMapData.addressDR).then(res => res.json()).then(data => data.map(p => ({...p, sourceFile: 'address_dr.json'}))),
    fetch(wifiMapData.addressDT).then(res => res.json()).then(data => data.map(p => ({...p, sourceFile: 'address_dt.json'})))
  ]).then(([dataRT, dataDR, dataDT]) => {
    const allData = [...dataRT, ...dataDR, ...dataDT];

    // Функция для создания смещения точек с одинаковыми координатами
    function offsetDuplicateCoordinates(points) {
      const coordCounts = {};
      const processedPoints = [];

      // Первый проход - подготавливаем данные и считаем дубликаты
      points.forEach(point => {
        let coordsStr = point.координаты.trim();
        let coordsArr = coordsStr.split(/[\s,]+/);
        if (coordsArr.length >= 2) {
          let latitude = parseFloat(coordsArr[0]);
          let longitude = parseFloat(coordsArr[1]);
          if (!isNaN(latitude) && !isNaN(longitude)) {
            const key = `${latitude.toFixed(6)}_${longitude.toFixed(6)}`;
            
            if (!coordCounts[key]) {
              coordCounts[key] = [];
            }
            
            point.originalLat = latitude;
            point.originalLon = longitude;
            point.coordKey = key;
            point.isDR = (point.sourceFile === 'address_dr.json');
            point.isDT = (point.sourceFile === 'address_dt.json');
            point.оператор = point.оператор || 'Неизвестный оператор';
            
            coordCounts[key].push(point);
            processedPoints.push(point);
          }
        }
      });

      // Второй проход - применяем адаптивные смещения
      Object.values(coordCounts).forEach(duplicatePoints => {
        if (duplicatePoints.length > 1) {
          duplicatePoints.forEach((point, index) => {
            const count = duplicatePoints.length;
            let offsetDistance;
            
            // Адаптивное расстояние в зависимости от количества точек
            if (count <= 4) {
              // Для малого количества точек - фиксированное небольшое расстояние
              offsetDistance = 0.00005; // ~5 метров
            } else if (count <= 8) {
              // Для среднего количества - умеренное расстояние
              offsetDistance = 0.0003; // ~30 метров
            } else {
              // Для большого количества - максимальное расстояние
              offsetDistance = 0.0005; // ~50 метров
            }
            
            // Создаем круговое смещение для точек
            const angle = (2 * Math.PI * index) / duplicatePoints.length;
            
            // Исправляем овальность - учитываем широту для правильного круга
            const latOffset = offsetDistance * Math.cos(angle);
            // Корректируем долготу с учетом широты для получения правильного круга
            const lonOffset = offsetDistance * Math.sin(angle) / Math.cos(point.originalLat * Math.PI / 180);
            
            point.finalLat = point.originalLat + latOffset;
            point.finalLon = point.originalLon + lonOffset;
          });
        } else {
          // Если точка единственная, координаты остаются без изменений
          duplicatePoints[0].finalLat = duplicatePoints[0].originalLat;
          duplicatePoints[0].finalLon = duplicatePoints[0].originalLon;
        }
      });

      return processedPoints;
    }

    const processedPoints = offsetDuplicateCoordinates(allData);

    // Создаем радиусы только для уникальных оригинальных координат
    const radiusCircles = [];
    const uniqueOriginalCoords = new Set();
    processedPoints.forEach(point => {
      const coordKey = `${point.originalLat.toFixed(6)}_${point.originalLon.toFixed(6)}`;
      if (!uniqueOriginalCoords.has(coordKey)) {
        uniqueOriginalCoords.add(coordKey);
        
        const radiusColor = 'rgba(30, 151, 254, 0.15)';
        const strokeColor = '#1e97fe';

        const radiusCircle = new ymaps.Circle(
          [[point.originalLat, point.originalLon], 50],
          {},
          {
            fillColor: radiusColor,
            strokeColor: strokeColor,
            strokeOpacity: 0.6,
            strokeWidth: 2,
            cursor: 'default',
            interactive: false,
            visible: false
          }
        );

        radiusCircles.push(radiusCircle);
        map.geoObjects.add(radiusCircle);
      }
    });

    // Функция управления видимостью радиусов
    function updateRadiusVisibility() {
      const zoom = map.getZoom();
      const showRadius = zoom >= 17;
      radiusCircles.forEach(circle => {
        circle.options.set('visible', showRadius);
      });
    }

    const geoObjects = [];
    let activeBalloon = null;

    // Создаем отдельную метку для каждой точки
    processedPoints.forEach(point => {
      const latitude = point.finalLat;
      const longitude = point.finalLon;
      
      // Формируем информацию о Wi-Fi сети и расположении
      let wifiInfo = '';
      const networkName = point['Имя сети'] && point['Имя сети'].trim();
      const location = point['Расположение'] && point['Расположение'].trim();
      
      if (networkName || location) {
        if (networkName) {
          wifiInfo += `<p><strong>Имя сети:</strong> ${networkName}</p>`;
        }
        if (location) {
          wifiInfo += `<p><strong>Расположение:</strong> ${location}</p>`;
        }
      }
      
      const balloonContent = `
        <div class="custom-balloon">
          <h2>Точка доступа</h2>
          <p>${point.оператор}</p>
          <p>Публичная точка доступа №${point.номер}</p>
          <p>${point.адрес}</p>
          ${wifiInfo}
          <button class="custom-button copy-button"
            data-coords="${point.originalLat.toFixed(6)}, ${point.originalLon.toFixed(6)}">Копировать координаты</button>
          <button class="custom-button show-ymaps-button"
            data-lat="${point.originalLat.toFixed(6)}"
            data-lon="${point.originalLon.toFixed(6)}">Показать на Я.Карты</button>
        </div>
      `;

      // Создаем метку со стандартной иконкой (пока кастомная не работает)
      const placemark = new ymaps.Placemark([latitude, longitude], {
        balloonContent: balloonContent
      }, {
        preset: 'islands#blueCircleDotIcon',
        balloonPanelMaxMapArea: 0
      });

      // Метку добавляем в массив для кластеризации, а не напрямую на карту
      placemark.events.add('click', () => {
        if (activeBalloon && activeBalloon !== placemark) {
          activeBalloon.balloon.close();
        }
        placemark.balloon.open();
        activeBalloon = placemark;

        setTimeout(() => {
          const btn = document.querySelector('.copy-button');
          if (btn) {
            btn.onclick = () => {
              const coordsText = btn.getAttribute('data-coords');
              copyToClipboard(coordsText);
            };
          }
          const showBtn = document.querySelector('.show-ymaps-button');
          if (showBtn) {
            showBtn.onclick = () => {
              const lat = showBtn.getAttribute('data-lat');
              const lon = showBtn.getAttribute('data-lon');
              openYandexMaps(lat, lon);
            };
          }
        }, 0);
      });

      geoObjects.push(placemark);
    });

    // Добавляем кластеризацию с динамическим управлением
    const clusterer = new ymaps.Clusterer({
      preset: 'islands#invertedBlueClusterIcons',
      groupByCoordinates: false,
      clusterDisableClickZoom: false,
      clusterHideIconOnBalloonOpen: false,
      geoObjectHideIconOnBalloonOpen: false,
      gridSize: 200,  // Еще больше увеличиваем размер сетки
      minClusterSize: 3  // Минимум 3 точки для кластера
    });
    
    // Управляем кластеризацией в зависимости от зума
    function updateClusterization() {
      const zoom = map.getZoom();
      if (zoom > 13) {
        // При большом зуме убираем кластеризацию и показываем отдельные точки
        if (map.geoObjects.indexOf(clusterer) !== -1) {
          map.geoObjects.remove(clusterer);
        }
        geoObjects.forEach(obj => {
          if (map.geoObjects.indexOf(obj) === -1) {
            map.geoObjects.add(obj);
          }
        });
      } else {
        // При малом зуме убираем отдельные точки и включаем кластеризацию
        geoObjects.forEach(obj => {
          if (map.geoObjects.indexOf(obj) !== -1) {
            map.geoObjects.remove(obj);
          }
        });
        if (map.geoObjects.indexOf(clusterer) === -1) {
          map.geoObjects.add(clusterer);
        }
      }
    }
    
    // Слушаем изменение зума
    map.events.add('boundschange', () => {
      updateClusterization();
      updateRadiusVisibility();
    });
    
    // Изначальная настройка
    clusterer.add(geoObjects);
    updateClusterization();
    updateRadiusVisibility();
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

  function openYandexMaps(lat, lon) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    let url;
    if (isMobile) {
      url = `yandexmaps://maps.yandex.ru/?pt=${lon},${lat}&z=16&l=map`;
    } else {
      url = `https://yandex.ru/maps/?ll=${lon}%2C${lat}&z=16&pt=${lon},${lat}`;
    }
    window.open(url, '_blank');
  }
}