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
    if (!serverRunning) {
      setServerRunning(await getServerStatus());
    }
    if (sse) {
      console.log(sse);
      const res = await enqueueTask(url, type);
      document.getElementById("scrapelog").innerText += res.data + "\n";
      return;
    }
    const _sse = new EventSource(`${URI}/scrape?url=${url}&type=${type}`);
    setSse(_sse);
    sseRef.current.addEventListener("message", (msg) => {
      document.getElementById("scrapelog").innerText += msg.data + "\n";
    });
    sseRef.current.addEventListener("error", () => {
      setScraperRunning(false);
      sseRef.current.close();
    });
    setScraperRunning(true);
  };

  const enqueueTask = async (url, type) => {
    return await axios.post(`${URI}/enqueue`, { url, type });
  };

  const handleExport = async (event) => {
    event.preventDefault();
    const urlScraped = await axios.get(`${URI}/check?url=${url}&type=${type}`);
    if (!urlScraped.data) {
      console.log("this URL hasn't been scraped!");
      return;
    }
    window.open(`${URI}/export?url=${url}&type=${type}`);
  };

  const handleStopScraper = async (event) => {
    event.preventDefault();
    const res = await axios.post(`${URI}/kill`);
    console.log(res.data);
    if (sse) {
      sse.close();
    }
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
          <h2 className> Actions/Commands </h2>
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
                Running this action exports the contributors associated with the
                URL given to a CSV.
              </p>
              <p>
                For exporting a repo, all of the contributors to that repo get
                exported.
              </p>
              <p>
                For exporting an organization, we first get the repositories in
                that organization, and then export all of the contributors to
                each of those repos.
              </p>
              <p>
                Type and URL can be left empty here. If they are left empty, all
                of the users that have not been marked as exported, and are
                available for export, are exported.
              </p>
            </div>
          )}
          {activeSection === "scrape" && (
            <div id="scrapeDocs">
              <p>
                This is how you start the scraper. You shouldn't run this more
                than once unless the scraper runs into an error and crashes and
                you have to restart it.
              </p>
              <p>
                In the top left of this page, you can see an indicator for
                whether the scraper is running or not. If it's running, don't
                start the scraper again. If you do, there will be more than 1
                scraper running which will cause issues with data collection.
              </p>
              <p>
                Given a URL and the type the URL is, a task for scraping the URL
                gets added to the front of the queue.
                <p>
                  Since it gets added to the front of the queue, this URL will
                  get scraped in the next batch of tasks. Each batch takes just
                  a few seconds so this should be quick!
                </p>
                <p>
                  This should be the primary way to scrape a URL. Rather than
                  having to restart the scraper in order to scrape a specific
                  URL, we can keep the scraper running and just add a URL to the
                  front of the queue. This way, the workflow is uninterrupted
                  and more efficient.
                </p>
              </p>
            </div>
          )}
          {activeSection === "check" && (
            <div id="checkDocs">
              <p>
                Checks if URL has been scraped, as well as if the contributors
                associated with a URL have been fully scraped.
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
                <button onClick={handleScrape} className={styles.btnPrimary}>
                  {loading ? <Spinner /> : "Scrape"}
                </button>
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
                <button onClick={handleExport} className={styles.btnPrimary}>
                  {loading ? <Spinner /> : "Export"}
                </button>
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
                <button onClick={handleCheck} className={styles.btnPrimary}>
                  {loading ? <Spinner /> : "Check if Scraped"}
                </button>
              </form>
              {/* {!repoDataIsLoaded === false ? <Oval height={40} width={40} /> : null} */}
            </div>
          )}
          <div className={styles.containerGrey}>
            <code id="scrapelog" className={styles.scrollContainerGrey}></code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
