const sermonsPage = document.querySelector("[data-sermons-page]");

if (sermonsPage) {
  const bookIndex = sermonsPage.querySelector("[data-sermon-book-index]");
  const results = sermonsPage.querySelector("[data-sermon-results]");
  const status = sermonsPage.querySelector("[data-sermon-status]");
  const empty = sermonsPage.querySelector("[data-sermon-empty]");
  const search = sermonsPage.querySelector("[data-sermon-search]");
  const year = sermonsPage.querySelector("[data-sermon-year]");
  const tabs = [...sermonsPage.querySelectorAll("[data-sermon-view]")];
  const template = document.querySelector("#sermon-card-template");

  const oldTestament = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
    "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah",
    "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah",
    "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos", "Obadiah", "Jonah", "Micah",
    "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi"
  ];
  const newTestament = [
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians",
    "Ephesians", "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy",
    "2 Timothy", "Titus", "Philemon", "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John",
    "3 John", "Jude", "Revelation"
  ];

  let sermons = [];
  let activeView = "books";
  let activeBook = "";
  let visibleCount = 20;

  const normalize = (value) => String(value || "").toLowerCase().normalize("NFKD");
  const formatDate = (value) => new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));

  function scripturePosition(sermon) {
    const bookPrefixes = {
      Psalms: "Psalms?",
      "Song of Solomon": "(?:Song of Solomon|Song of Songs)",
      "1 Peter": "(?:1 Peter|1st Peter)"
    };
    const prefix = bookPrefixes[sermon.book] || sermon.book.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const passage = sermon.title.replace(new RegExp(`^${prefix}\\s*`, "i"), "");
    const numbers = passage.match(/\d+/g)?.map(Number) || [];
    return {
      chapter: numbers[0] ?? Number.MAX_SAFE_INTEGER,
      verse: numbers[1] ?? 0
    };
  }

  function comparePassages(a, b) {
    const aPosition = scripturePosition(a);
    const bPosition = scripturePosition(b);
    return aPosition.chapter - bPosition.chapter
      || aPosition.verse - bPosition.verse
      || a.title.localeCompare(b.title, undefined, { numeric: true })
      || a.date.localeCompare(b.date);
  }

  function filteredSermons() {
    const query = normalize(search.value).trim();
    const matches = sermons.filter((sermon) => {
      if (activeBook && sermon.book !== activeBook) return false;
      if (year.value && !sermon.date.startsWith(year.value)) return false;
      if (!query) return true;
      return normalize([sermon.title, sermon.book, sermon.description, sermon.date].join(" ")).includes(query);
    });
    return activeBook ? matches.sort(comparePassages) : matches;
  }

  function makeBookSection(title, books, counts) {
    const section = document.createElement("section");
    section.className = "sermon-testament";
    const heading = document.createElement("h2");
    heading.textContent = title;
    const list = document.createElement("ul");

    const availableBooks = books.filter((book) => counts.has(book));
    list.style.setProperty("--sermon-book-rows", Math.ceil(availableBooks.length / 2));

    availableBooks.forEach((book) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.book = book;
      button.innerHTML = `<span>${book}</span><strong>${counts.get(book)}</strong>`;
      item.append(button);
      list.append(item);
    });
    section.append(heading, list);
    return section;
  }

  function renderBookIndex() {
    const counts = new Map();
    sermons.forEach(({ book }) => {
      if (book) counts.set(book, (counts.get(book) || 0) + 1);
    });
    bookIndex.replaceChildren(
      makeBookSection("Old Testament", oldTestament, counts),
      makeBookSection("New Testament", newTestament, counts)
    );
  }

  function makeCard(sermon) {
    const card = template.content.firstElementChild.cloneNode(true);
    card.querySelector("[data-date]").textContent = formatDate(sermon.date);
    card.querySelector("[data-book]").textContent = sermon.book || "Sermon";
    card.querySelector("[data-title]").textContent = sermon.title;
    const description = card.querySelector("[data-description]");
    description.textContent = sermon.description || "Listen to this sermon from the New Covenant OPC archive.";

    const audio = card.querySelector("[data-audio]");
    if (sermon.audioUrl) {
      audio.src = sermon.audioUrl;
      audio.setAttribute("aria-label", `Listen to ${sermon.title}`);
    } else {
      audio.remove();
    }

    const source = card.querySelector("[data-source]");
    source.href = sermon.sourceUrl;
    source.textContent = sermon.audioUrl ? "Sermon details ↗" : "Watch or view sermon ↗";
    return card;
  }

  function renderResults() {
    const matches = filteredSermons();
    results.replaceChildren(...matches.slice(0, visibleCount).map(makeCard));

    if (matches.length > visibleCount) {
      const loadMore = document.createElement("button");
      loadMore.className = "button sermon-load-more";
      loadMore.type = "button";
      loadMore.textContent = `Show more (${matches.length - visibleCount} remaining)`;
      loadMore.addEventListener("click", () => {
        visibleCount += 20;
        renderResults();
      });
      results.append(loadMore);
    }

    const subject = activeBook ? ` in ${activeBook}` : "";
    status.textContent = `${matches.length} sermon${matches.length === 1 ? "" : "s"}${subject}`;
    empty.hidden = matches.length !== 0;
    results.hidden = false;
  }

  function showBooks() {
    activeView = "books";
    activeBook = "";
    visibleCount = 20;
    bookIndex.hidden = false;
    results.hidden = true;
    empty.hidden = true;
    status.textContent = `${sermons.length} sermons organized by book of the Bible`;
    setActiveTab("books");
  }

  function showResults(book = "") {
    activeView = "latest";
    activeBook = book;
    visibleCount = 20;
    bookIndex.hidden = true;
    setActiveTab("latest");
    renderResults();
    document.querySelector(".sermon-browser").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function setActiveTab(view) {
    tabs.forEach((tab) => {
      const active = tab.dataset.sermonView === view;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
  }

  function populateYears() {
    const years = [...new Set(sermons.map(({ date }) => date.slice(0, 4)))].sort().reverse();
    year.append(...years.map((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      return option;
    }));
  }

  bookIndex.addEventListener("click", (event) => {
    const button = event.target.closest("[data-book]");
    if (button) showResults(button.dataset.book);
  });

  tabs.forEach((tab) => tab.addEventListener("click", () => {
    if (tab.dataset.sermonView === "books") showBooks();
    else showResults();
  }));

  search.addEventListener("input", () => {
    visibleCount = 20;
    if (search.value.trim() && activeView === "books") showResults();
    else if (activeView === "latest") renderResults();
  });

  year.addEventListener("change", () => {
    visibleCount = 20;
    if (year.value && activeView === "books") showResults();
    else if (activeView === "latest") renderResults();
  });

  fetch("content/sermons.json")
    .then((response) => {
      if (!response.ok) throw new Error(`Could not load sermons (${response.status})`);
      return response.json();
    })
    .then((data) => {
      sermons = (data.sermons || []).sort((a, b) => b.date.localeCompare(a.date));
      renderBookIndex();
      populateYears();
      showBooks();
    })
    .catch(() => {
      status.textContent = "The sermon archive is temporarily unavailable.";
      bookIndex.hidden = true;
    });
}
