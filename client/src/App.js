import { useState, useEffect, useRef } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Spinner from "./components/Spinner";

function App() {
  const URI = "http://localhost:8080";
  const [url, setUrl] = useState("");
  const [type, setType] = useState("user");
  const [scraperRunning, setScraperRunning] = useState();
  const [serverRunning, setServerRunning] = useState();
  const [activeSection, setActiveSection] = useState("scrape");
  const [sse, _setSse] = useState();
  const [serverLoading, setServerLoading] = useState(false);
  const [loading, setLoading] = useState(false);

  const sseRef = useRef(sse);
  const setSse = (sse) => {
    sseRef.current = sse;
    _setSse(sse);
  };

  const headers = {
    "Access-Control-Allow-Origin": "*",
  };

  const handleCheck = async (event) => {
    event.preventDefault();
    await checkIfUrlScraped(url, type);
  };

  const checkIfUrlScraped = async (urlToCheck, type) => {
    setLoading(true);
    const res = await axios.get(`${URI}/check?url=${urlToCheck}&type=${type}`, {
      headers,
    });
    if (!res) {
      setLoading(false);
      return undefined;
    }
    const { scraped, tasks, url } = res.data;
    setLoading(false);

    const textEl = document.getElementById("checkUrlText");
    if (!tasks) {
      textEl.innerText = `${url} was not found in the database.`;
      return false;
    }
    if (!scraped) {
      textEl.innerText = `${url} has ${tasks.length} queued tasks left.`;
      const tasksHtml = document.getElementById("tasksList");
      tasks.forEach((el) => {
        tasksHtml.innerHTML += <li>{el}</li>;
      });
      return false;
    }
    textEl.innerText = `${url} has been fully scraped.`;
    return true;
  };

  const getScraperStatusPoll = async () => {
    const res = await axios.get(`${URI}/status`);
    if (!res) {
      return undefined;
    }
    return res.data.active;
  };

  const getServerStatus = async () => {
    setServerLoading(true);
    const res = await axios.get(`${URI}/ping`).catch((e) => {
      console.error(e);
      setServerLoading(false);
    });
    setServerLoading(false);
    if (!res) {
      return undefined;
    }
    return res.data.active;
  };

  const getServerStatusPoll = async () => {
    const res = await axios.get(`${URI}/ping`);
    return res.data.active;
  };

  const statusPoll = async (interval, triesLeft, maxTries) => {
    if (triesLeft === 0) {
      console.error("Server is not responding!");
      if (sse) {
        sse.close();
      }
      return;
    }
    try {
      const serverRunning = await getServerStatusPoll();
      const scraperRunning = await getScraperStatusPoll();
      setServerRunning(serverRunning);
      setScraperRunning(scraperRunning);
      await new Promise((resolve) => setTimeout(resolve, interval));
      await statusPoll(5000, maxTries, maxTries);
    } catch (error) {
      console.error(error);
      setServerRunning(false);
      setScraperRunning(false);
      await new Promise((resolve) => setTimeout(resolve, interval));
      await statusPoll(5000, --triesLeft, maxTries);
    }
  };

  const handleScrape = async (event) => {
    event.preventDefault();

    if (scraperRunning) {
      const res = await enqueueTask(url, type);
      document.getElementById("scrapelog").innerText += res.data + "\n";
      return;
    }
    setScraperRunning(true);
    const _sse = new EventSource(`${URI}/scrape?url=${url}&type=${type}`);
    setSse(_sse);
    sseRef.current.addEventListener("message", (msg) => {
      document.getElementById("scrapelog").innerText += msg.data + "\n";
    });
    sseRef.current.addEventListener("error", () => {
      setScraperRunning(false);
      sseRef.current.close();
    });
  };

  const enqueueTask = async (url, type) => {
    return await axios.post(`${URI}/enqueue`, { url, type });
  };

  const handleExport = async (event) => {
    event.preventDefault();
    await checkIfUrlScraped(url, type);
    window.open(`${URI}/export?url=${url}&type=${type}`);
  };

  const handleStopScraper = async (event) => {
    event.preventDefault();
    setLoading(true);
    await axios.post(`${URI}/kill`);
    if (sseRef.current) {
      sseRef.current.close();
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => await statusPoll(5000, 5, 5))();
  }, []);

  return (
    <div className={styles.containerMain}>
      <div className={styles.header}>
        <div className={styles.status}>
          <span
            className={serverRunning ? styles.activeDot : styles.inactiveDot}
          ></span>
          Server Status:
          {serverRunning ? " running" : " not running"}
        </div>
        <div className={styles.status}>
          <span
            className={scraperRunning ? styles.activeDot : styles.inactiveDot}
          ></span>
          Scraper Status:
          {scraperRunning ? " running" : " not running"}
        </div>
        <div>
          {!serverRunning && (
            <button
              onClick={async () => {
                const serverActive = await getServerStatus();
                if (serverActive) {
                  await statusPoll(5000, 5, 5);
                }
              }}
              className={styles.btnPrimary}
            >
              {serverLoading ? <Spinner /> : "Check Server Status"}
            </button>
          )}
          {scraperRunning && (
            <button onClick={handleStopScraper} className={styles.btnPrimary}>
              {loading ? <Spinner /> : "Stop Scraper"}
            </button>
          )}
        </div>
      </div>
      <div className={styles.containerBody}>
        <div className={styles.navSection}>
          <h2> Actions/Commands </h2>
          <ul className={styles.navList}>
            <li
              onClick={() => {
                setActiveSection("scrape");
                setType("user");
                setUrl("");
              }}
              className={
                activeSection === "scrape"
                  ? styles.textActive
                  : styles.textDisabled
              }
            >
              Scrape
            </li>
            <li
              onClick={() => {
                setActiveSection("export");
                setType("user");
                setUrl("");
              }}
              className={
                activeSection === "export"
                  ? styles.textActive
                  : styles.textDisabled
              }
            >
              Export User Data to CSV
            </li>
            <li
              onClick={() => {
                setActiveSection("check");
                setType("user");
                setUrl("");
              }}
              className={
                activeSection === "check"
                  ? styles.textActive
                  : styles.textDisabled
              }
            >
              Check if a URL Has Been Scraped
            </li>
          </ul>
        </div>
        <div className={styles.scrollContainer}>
          <h2> Documentation </h2>
          {activeSection === "export" && (
            <div id="exportDocs">
              <p>
                Exports the contributors associated with the given URL to a CSV.
              </p>
              <p>
                For exporting a repo, all of the fully scraped contributors to
                that repo get exported.
              </p>
              <p>
                For exporting an organization, we first get the repositories in
                that organization, and then export all of the fully scraped
                contributors for each of those repos.
              </p>
              <p>
                URL can be left empty here. If they are left empty, all of the
                users that have not been marked as exported, and are available
                for export, are exported.
              </p>
            </div>
          )}
          {activeSection === "scrape" && (
            <div id="scrapeDocs">
              <p>This is how you start the scraper.</p>
              <p>
                You can only have one instance of the scraper running at once.
                If the scraper is already running, trying to run it again will
                only scrape the given URL, and then quit. The original scraper
                will continue to run tasks from the queue.
              </p>
              <p>
                If the scraper is running, a button labeled “Stop Scraper” will
                appear in the top right.
              </p>
              <p>
                When running the scraper, inputting a URL to scrape is optional
                — if you do not provide one, then the scraper will immediately
                begin running tasks from the task queue. If the scraper is
                already running and you do not input a URL, nothing will happen.
              </p>
            </div>
          )}
          {activeSection === "check" && (
            <div id="checkDocs">
              <p>Checks if URL has been fully scraped.</p>
              <p>
                Checking if a user has been scraped has only 1 step: 1. Checking
                if there are any queued tasks for the user. If yes, then this
                user has not been fully scraped. If there are no queued for the
                user, then they have been fully scraped.
              </p>
              <p>
                Checking if a repository has been scraped has involves 2 steps:
                1. Checking if there are any queued tasks for this repository 1.
                If yes, then this repository has not been fully scraped and we
                can end the check at this step. If there are no queued tasks, we
                can continue to the step 2. 2. Check if every contributor to the
                repository has been fully scraped. 1. If any contributors have
                g.t. 0 queued tasks, then this repository has not been fully
                scraped.
              </p>
              <p>
                Checking if an organization has been scraped is as follows: 1.
                Checking if there are any queued tasks for this organization 1.
                If yes, then this organization has not been fully scraped. If
                there are no queued tasks, we can continue to the step 2. 2.
                Check if every repository in the organization has been fully
                scraped. We just showed above that there are 2 steps to checking
                if a repository has been scraped: 1. Check if there are any
                queued tasks for the repository 2. Check if every contributor to
                the repository has been fully scraped. 3. So we say that a given
                organization has been fully scraped if, for each and every
                repository belonging to the organization, every contributor to
                the repository has been fully scraped.
              </p>
            </div>
          )}
        </div>
        <div className={styles.main}>
          {activeSection === "scrape" && (
            <div>
              <h2>Scrape</h2>
              <form>
                <div className={styles.formRow}>
                  <label for="scrapeUrl">URL</label>
                  <input
                    className={styles.textContainer}
                    type="text"
                    id="scrapeUrl"
                    onChange={(e) => {
                      setUrl(e.target.value);
                    }}
                  />
                </div>
                <div className={styles.formRow}>
                  <label for="scrapeType">Type</label>
                  <select
                    className={styles.textContainer}
                    name="scrapeType"
                    id="scrapeType"
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="repo">Repo</option>
                    <option value="org">Org</option>
                  </select>
                </div>
                {serverRunning && (
                  <button onClick={handleScrape} className={styles.btnPrimary}>
                    {loading ? <Spinner /> : "Scrape"}
                  </button>
                )}
              </form>
            </div>
          )}
          {activeSection === "export" && (
            <div>
              <h2>Export</h2>
              <form>
                <div className={styles.formRow}>
                  <label for="exportUrl">URL</label>
                  <input
                    className={styles.textContainer}
                    type="text"
                    id="exportUrl"
                    onChange={(e) => {
                      setUrl(e.target.value);
                    }}
                  />
                </div>
                <div className={styles.formRow}>
                  <label for="exportType">Type</label>
                  <select
                    className={styles.textContainer}
                    name="exportType"
                    id="exportType"
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="repo">Repo</option>
                    <option value="org">Org</option>
                  </select>
                </div>
                {serverRunning && (
                  <button onClick={handleExport} className={styles.btnPrimary}>
                    {loading ? <Spinner /> : "Export"}
                  </button>
                )}
              </form>
              <div id="checkUrlText">
                <ol id="tasksList"></ol>
              </div>
            </div>
          )}
          {activeSection === "check" && (
            <div>
              <h2>Check</h2>
              <form>
                <div className={styles.formRow}>
                  <label for="checkUrl">URL</label>
                  <input
                    className={styles.textContainer}
                    type="text"
                    id="checkUrl"
                    onChange={(e) => {
                      setUrl(e.target.value);
                    }}
                  />
                </div>
                <div className={styles.formRow}>
                  <label for="checkType">Type</label>
                  <select
                    className={styles.textContainer}
                    name="checkType"
                    id="checkType"
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="user">User</option>
                    <option value="repo">Repo</option>
                    <option value="org">Org</option>
                  </select>
                </div>
                {serverRunning && (
                  <button onClick={handleCheck} className={styles.btnPrimary}>
                    {loading ? <Spinner /> : "Check if Scraped"}
                  </button>
                )}
              </form>
              <div id="checkUrlText">
                <ol id="tasksList"></ol>
              </div>
            </div>
          )}
          {scraperRunning && (
            <div className={styles.containerGrey}>
              <code
                id="scrapelog"
                className={styles.scrollContainerGrey}
              ></code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
