import { useState, useEffect, useRef } from "react";
import axios from "axios";
import styles from "./styles.module.css";
import Spinner from "./components/Spinner";
import React from "react";
import { io } from "socket.io-client";

const URI = "http://localhost:8080";
const socket = io(URI);

function App() {
  const [url, setUrl] = useState("");
  const [type, setType] = useState("user");
  const [scraperRunning, setScraperRunning] = useState(false);
  const [serverRunning, setServerRunning] = useState(false);
  const [activeSection, setActiveSection] = useState("scrape");
  const [sse, _setSse] = useState();
  const [serverLoading, setServerLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unexportedOnly, setUnexportedOnly] = useState(false);
  const [checkUrlText, setCheckUrlText] = useState("");
  const [tasksLeftForUrl, setTasksLeftForUrl] = useState([]);
  const [error, setError] = useState("");
  const scrapeLogRef = useRef(null);

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

    if (!tasks) {
      setCheckUrlText(`${url} has not been scraped yet`);
      return false;
    }

    if (!scraped) {
      setCheckUrlText(`${url} has ${tasks.length} queued tasks left.`);
      setTasksLeftForUrl(tasks);
      return false;
    }

    setCheckUrlText(`${url} has been scraped`);
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
      if (sseRef.current) {
        sseRef.current.close();
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
      scrapeLogRef.current.innerText += res.data + "\n";
      return;
    }
    setError("");
    setScraperRunning(true);
    const _sse = new EventSource(`${URI}/scrape?url=${url}&type=${type}`);
    setSse(_sse);
    sseRef.current.addEventListener("message", (msg) => {
      scrapeLogRef.current.innerText += msg.data + "\n";
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
    if (url === "") {
      window.open(
        `${URI}/export?url=${url}&type=${type}&unexportedOnly=${unexportedOnly}`
      );
      return;
    }
    setLoading(true);
    const res = await axios.get(`${URI}/check?url=${url}&type=${type}`, {
      headers,
    });
    setLoading(false);
    if (!res) {
      return;
    }
    const { scraped, tasks } = res.data;

    if (!tasks) {
      setCheckUrlText(`${url} has not been scraped yet`);
      return;
    }

    if (!scraped) {
      setCheckUrlText(`${url} has ${tasks.length} queued tasks left.`);
      setTasksLeftForUrl(tasks);
    }

    window.open(
      `${URI}/export?url=${url}&type=${type}&unexportedOnly=${unexportedOnly}`
    );
  };

  const handleStopScraper = async (event) => {
    event.preventDefault();
    setLoading(true);
    scrapeLogRef.current.innerText +=
      "finishing up existing tasks... this might take a few minutes\n";
    const res = await axios.post(`${URI}/kill`);
    scrapeLogRef.current.innerText += res.data + "\n";
    if (sseRef.current) {
      sseRef.current.close();
    }
    setLoading(false);
  };

  useEffect(() => {
    (async () => await statusPoll(5000, 5, 5))();
  }, []);

  useEffect(() => {
    socket.on("SCRAPE_MESSAGE", (msg) => {
      scrapeLogRef.current.innerText += msg + "\n";
    });
    return () => {
      socket.close();
    };
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
              Scrape/Enqueue
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
            <div id="exportDocs" className={styles.docsText}>
              <p>
                Exports the contributors associated with the given URL to a CSV.
                An option to export only unexported users is available. If this
                option is not checked, all users associated with the URL will be
                exported, even if they have already been exported. If this
                option is checked, only users who have not been exported will be
                exported. Essentially this can avoid duplicate records being
                downloaded to avoid issues with importing into recruiting
                management sites like Gem.
              </p>
              <p>
                When exporting a user, just that one single user will get
                exported.
              </p>
              <p>
                When exporting a repo, all of the fully scraped contributors to
                that repo get exported.
              </p>
              <p>
                When exporting an organization, we first get the repositories in
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
            <div id="scrapeDocs" className={styles.docsText}>
              <p>
                This is how you start the scraper. Just input a URL and make the
                sure type of the URL is correct (is it a GitHub repo,
                organization, or user?), click the 'Scrape' button, and the
                scraper should start running if it is not already. Note that the
                Scrape button is hidden if the server is not running (you can
                see the status in the top-right corner of this page).
              </p>
              <p>
                If the scraper is already running, clicking 'Scrape' will
                instead queue up the URL you inputted, and send it to the front
                of the queue. In practice, it should take anywhere between a few
                seconds to a few minutes for the URL you queued up to actually
                get scraped, depending on how long it takes to finish scraping
                the URLs being scraped at the time you clicked 'Scrape'.
              </p>
              <p>
                Once you start the scraper, a log to keep track of who gets
                scraped will show up on the right-hand side of the screen below
                the space for URL/Type input. This will update on its own while
                the scraper is running. When the scraper is not running, the log
                is cleared and hides because it's shy. The log will stay empty
                until the next time you run the scraper.
              </p>
              <p>
                If the scraper is running, a button labeled 'Stop Scraper' will
                appear in the top right.
              </p>
              <p>
                When initially starting the scraper, inputting a URL to scrape
                is optional — if you do not provide one, then the scraper will
                immediately begin running tasks from the task queue. If the
                scraper is already running and you do not input a URL, you will
                see a message that a URL is required.
              </p>
            </div>
          )}
          {activeSection === "check" && (
            <div id="checkDocs" className={styles.docsText}>
              <p>Checks if URL has been fully scraped.</p>
              <p>
                Checking if a user has been scraped has only 1 step: 1. Checking
                if there are any queued tasks for the user. If yes, then this
                user has not been fully scraped. If there are no queued for the
                user, then they have been fully scraped.
              </p>
              <p>
                Checking if a repository has been scraped has involves 2 steps:
              </p>
              <p>
                1. Checking if there are any queued tasks for this repository 1.
                If yes, then this repository has not been fully scraped and we
                can end the check at this step. If there are no queued tasks, we
                can continue to the step 2.
              </p>
              <p>
                2. Check if every contributor to the repository has been fully
                scraped. 1. If any contributors have g.t. 0 queued tasks, then
                this repository has not been fully scraped.
              </p>
              <p>Checking if an organization has been scraped is as follows:</p>
              <p>
                1. Checking if there are any queued tasks for this organization
                1. If yes, then this organization has not been fully scraped. If
                there are no queued tasks, we can continue to the step 2.{" "}
              </p>
              <p>
                2. Check if every repository in the organization has been fully
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
                  <label htmlFor="scrapeUrl">URL</label>
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
                  <label htmlFor="scrapeType">Type</label>
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
                {serverRunning && !loading && (
                  <button onClick={handleScrape} className={styles.btnPrimary}>
                    Scrape
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
                  <label htmlFor="exportUrl">URL</label>
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
                  <label htmlFor="exportType">Type</label>
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
                  <>
                    <div>
                      <label>
                        <input
                          type="checkbox"
                          checked={unexportedOnly}
                          onChange={() => setUnexportedOnly(!unexportedOnly)}
                        />
                        Only export previously unexported users
                      </label>
                    </div>
                    <div>
                      <i>
                        This is useful when you have exported something before
                        and don't want to get duplicate data in your CSVs.
                      </i>
                    </div>
                    <button
                      onClick={handleExport}
                      className={styles.btnPrimary}
                    >
                      Export
                    </button>
                    <div id="checkUrlText">{checkUrlText}</div>
                  </>
                )}
              </form>
            </div>
          )}
          {activeSection === "check" && (
            <div>
              <h2>Check</h2>
              <form>
                <div className={styles.formRow}>
                  <label htmlFor="checkUrl">URL</label>
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
                  <label htmlFor="checkType">Type</label>
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
                    Check If Scraped
                  </button>
                )}
              </form>
              <div id="checkUrlText">{checkUrlText}</div>
              <ol>
                {tasksLeftForUrl.map((task) => (
                  <li>
                    {task.url}
                    <ol>
                      {task.tasks.map((nestedTask) => (
                        <li>{nestedTask}</li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            </div>
          )}
          <div id="errormsg">{error}</div>
          <div
            className={styles.containerGrey}
            id="scrapelogContainer"
            style={{ opacity: activeSection === "scrape" ? 1 : 0 }}
          >
            <code
              id="scrapelog"
              className={styles.scrollContainerGrey}
              ref={scrapeLogRef}
            ></code>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
