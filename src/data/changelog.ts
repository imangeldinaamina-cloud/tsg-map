import type { Locale } from "@/i18n";

export const CHANGELOG: { version: string; date: string; items: Record<Locale, string[]> }[] = [
  {
    version: "0.2.0",
    date: "2026-11-05",
    items: {
      ru: [
        "Новый раздел «Анализ города»: население WorldPop 2021 на сетке 250 м, объекты и пешеходная сеть OSM, граница города.",
        "Временная модель присутствия с вашими допущениями (без них показывается базовое население).",
        "Индекс дефицита услуг по 6 категориям и пешей доступности 400/800/1200 м, карта пешего расстояния, список потенциально недообслуженных ячеек.",
        "Анализ локаций: до 4 вариантов, конкуренты, присутствие по периодам, пешеходная сеть и объяснимая оценка.",
        "Страница источников данных и ограничений, загрузка своих данных о населении (CSV).",
      ],
      kk: [
        "Жаңа «Қала талдауы» бөлімі: 250 м торда WorldPop 2021 халқы, OSM нысандары мен жаяу желі, қала шекарасы.",
        "Сіздің болжамдарыңызбен болудың уақыттық моделі (болжамсыз базалық халық көрсетіледі).",
        "6 санат пен 400/800/1200 м жаяу қолжетімділік бойынша қызмет тапшылығы индексі, жаяу қашықтық картасы, қызметі жеткіліксіз ұяшықтар тізімі.",
        "Орын талдауы: 4 нұсқаға дейін, бәсекелестер, кезеңдер бойынша болу, жаяу желі және түсіндірілетін бағалау.",
        "Дереккөздер мен шектеулер беті, өз халық деректеріңізді жүктеу (CSV).",
      ],
      en: [
        "New City analysis workspace: WorldPop 2021 population on a 250 m grid, OSM facilities and walk network, city boundary.",
        "Temporal presence model driven by your assumptions (without them the residential baseline is shown).",
        "Service Gap Index for 6 categories and 400/800/1200 m walking catchments, walking-distance map, list of potentially underserved cells.",
        "Location analysis: up to 4 candidates, competitors, presence by period, walk network and an explainable assessment.",
        "Data sources & limitations page, upload of your own population data (CSV).",
      ],
    },
  },
  {
    version: "0.1.0",
    date: "2026-11-05",
    items: {
      ru: [
        "Первая версия MVP: карта TSG, слоты времени, статический и динамический режимы, фильтр категорий, настраиваемый радиус.",
        "Панель зоны: D, S, TSG по слотам, объяснение оценки и значок качества данных.",
        "Рейтинг зон для бизнеса, сравнение режимов и выгрузка CSV (Pro, превью).",
        "Импорт реальных наблюдений из CSV с проверкой и сообщениями об ошибках.",
        "Методология и ограничения, отзывы, аналитика без персональных данных, лендинг и лист ожидания.",
        "Услуги из OpenStreetMap (выгрузка 2026-11-05). Реальных наблюдений пока нет — показаны демо-данные с баннером.",
      ],
      kk: [
        "MVP алғашқы нұсқасы: TSG картасы, уақыт аралықтары, статикалық және динамикалық режимдер, санат сүзгісі, бапталатын радиус.",
        "Аймақ панелі: уақыт аралықтары бойынша D, S, TSG, бағаның түсіндірмесі және деректер сапасының белгісі.",
        "Бизнеске арналған аймақтар рейтингі, режимдерді салыстыру және CSV жүктеу (Pro, алдын ала қарау).",
        "Нақты бақылауларды CSV-ден тексерумен және қате хабарламаларымен импорттау.",
        "Әдістеме мен шектеулер, пікірлер, жеке деректерсіз аналитика, лендинг және күту тізімі.",
        "OpenStreetMap қызметтері (2026-11-05 жүктелген). Нақты бақылаулар әлі жоқ — демо-деректер белгімен көрсетілген.",
      ],
      en: [
        "First MVP: TSG map, time slots, static and dynamic modes, category filter, configurable radius.",
        "Area panel: D, S, TSG per slot, a plain-language explanation and a data-quality badge.",
        "Area ranking for businesses, mode comparison and CSV export (Pro, preview).",
        "Import of real observations from CSV with validation and error messages.",
        "Methodology and limitations, feedback, analytics without personal data, landing page and waitlist.",
        "Services from OpenStreetMap (extracted 2026-11-05). No real observations yet — demo data shown with a banner.",
      ],
    },
  },
];
