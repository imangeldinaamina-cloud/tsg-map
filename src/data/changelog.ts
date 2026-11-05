import type { Locale } from "@/i18n";

export const CHANGELOG: { version: string; date: string; items: Record<Locale, string[]> }[] = [
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
