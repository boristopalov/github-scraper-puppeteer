## Github Scraper/Crawler

Fully autonomous GitHub scraper and crawler-- can collect data on GitHub repos, orgs, and users. Given a starting point (a URL for a public repo, org, or user), this program will collect data from that URL and begin to branch out to related repos, organizations, and users.

### How it runs

The scraper/crawler goes through the following steps when it runs:

1. A user is scraped. The data collected on the user is added to a collection in a MongoDB database. Two important data points collected in this step are any GitHub organizations that user is a member of, as well as any repositories that user has issued pull requests to.
2. These organizations and repositories are added to a task queue, which is also a collection in our database, to be scraped later. See the queue section for more context on how tasks get added to the queue.
3. A batch of tasks is dequeued and the tasks are run in parallel. The number of tasks dequeued can be changed in the source code, the default is 3. These tasks can involve either scraping a user, an organization, or a repository.
   1. If the task involves scraping a user, go back to step 1 to scrape the user
   2. If the task involves scraping a repository, the contributors to the repository are recorded, and added as tasks to the queue. Hopefully it is evident that these tasks will involve scraping a user.
   3. If the task involves scraping an organization, the repositories belonging to the organization are added as a task to the queue. These tasks will involve scraping a repository.
4. Once all tasks in the batch complete, go back to step 3 to run the next batch of tasks.

### Functionality

#### Export

Running this action exports the contributors associated with the
URL given to a CSV.

For exporting a repo, all of the fully scraped contributors to that repo get
exported. For exporting an organization, we first get the repositories in
that organization, and then export all of the fully scraped contributors for
each of those repos.

URL can be left empty here. If they are left empty, all
of the users that have not been marked as exported, and are
available for export, are exported.

#### Scrape

This is how you start the scraper. You can only have one instance of the scraper running at once. If the scraper is already running, running scrape again on a URL will only scrape that URL, and then quit. If you open the scraper in a new tab, you won't be able to start a new scraper. The original (and only) scraper will continue to run tasks from the queue. If the scraper is running, a button labeled “Stop Scraper” will appear in the top right.

When starting the scraper for the first time, inputting a URL to scrape is optional — if you do not provide one, then the scraper will immediately begin running tasks from the task queue. However, if the scraper is already running and you do not input a URL, nothing will happen.

#### Check

Checks if URL has been fully scraped.

Checking if a user has been scraped has only 1 step:

1. Checking if there are any queued tasks for the user. If yes, then this user has not been fully scraped. If there are no queued for the user, then they have been fully scraped.

Checking if a repository has been scraped has involves 2 steps:

1. Checking if there are any queued tasks for this repository
   1. If yes, then this repository has not been fully scraped and we can end the check at this step. If there are no queued tasks, we can continue to the step 2.
2. Check if every contributor to the repository has been fully scraped.
   1. If any contributors have >0 queued tasks, then this repository has not been fully scraped.

Checking if an organization has been scraped is as follows:

1. Checking if there are any queued tasks for this organization
   1. If yes, then this organization has not been fully scraped. If there are no queued tasks, we can continue to the step 2.
2. Check if every repository in the organization has been fully scraped. We just showed above that there are 2 steps to checking if a repository has been scraped:
   1. Check if there are any queued tasks for the repository
   2. Check if every contributor to the repository has been fully scraped.
3. So we say that a given organization has been fully scraped if, for each and every repository belonging to the organization, every contributor to the repository has been fully scraped.

#### Server/Scraper Status

In the top right, there are indicators for the status of both the server and the scraper. If the server is running, then you can start the scraper. Otherwise, you won’t be able to start the scraper, since it runs on the server.

### Database Structure

#### org object

- name
- url
- bioKeywordMatch
- numReposWithHundredStars
- numRepoReadmeKeywordMatch
- reposInOrg
- queuedTasks
- members
- createdAt
- updatedAt

#### repo object

- name
- url
- repoStarCount
- topLanguage
- isRepoReadmeKeywordMatch
- contributors
- queuedTasks
- createdAt
- updatedAt

#### user object

- name
- url
- email
- username
- location
- isInNewYork
- bio
- bioMatchesKeywords
- repoCommits
- numPullRequestReposWithHundredStars
- numPullRequestReposWithReadmeKeywordMatch
- queuedTasks
- exported
- contributionCount
- tenStarRepoCount
- isUserReadmeKeywordMatch
- userCompanyIsOrg
- githubFollowers
- githubFollowing
- numOrgBioKeywordMatch
- numOrgReposWithHundredStars
- numOrgReposReadmeKeywordMatch
- company
- createdAt
- updatedAt

### Miscellaneous

#### Bot Detection

If the scraper runs too quickly, or is running multiple tasks at once, it will likely be blocked by GitHub’s bot detection at some point. There is a check for this. If GitHub blocks the scraper, it will wait 2 minutes before trying again. If it is still blocked, it will wait 4 minutes. Then 8, 16, etc. This number resets down to 2 minutes after unblocking.

#### GitHub Loading Issues

Sometimes GitHub data simply doesn’t load, causing the scraper to error out. If this happens, it will try to scrape again. If data doesn’t load again, it skips the task and goes to the next task. The skipped task stays in the queue so that it gets tried again.

#### Concurrency

One of the parameters for the scraper is the task limit, which is essentially how many tasks get run per batch. This can be set as low as 1. There is no upper limit but you probably don’t want to set it to more than 4 or 5. Even if it goes higher, it will be slowed down by bot detection so there really isn’t any gain from running a large number of tasks at a time.

### Setting up a fresh copy (instructions are for Ubuntu)

1. First we need to set up the AWS EC2 instance. Instructions by Ashoat are in Linear.
2. Once that is set up, open up a terminal and ssh into the scraper machine. If you followed Ashoat’s instructions in the previous step, you should be able to do that with the following command: `ssh scraper`.
3. Next, we need to set up a VNC server in order for our AWS server to run programs that require an 'X' server. X servers allow programs to use GUIs. We need this because we will be running Puppeteer in headful, not headless mode, meaning that a graphical instance of Chromium will be launched. This is only possible if we have an Server to display Chromium in headful (i.e. GUI) mode.
4. Follow the first 4 steps of [this guide](https://ubuntu.com/tutorials/ubuntu-desktop-aws#1-overview) to set up a VNC server on the AWS machine. You should save the password used in setting up the VNC server in 1Password.
5. MacOS has a built-in client to connect to a VNC server. Open up Spotlight and type in `vnc://{your EC2 instance URl}:5901`. For example, `vnc://ec2-54-172-197-171.compute-1.amazonaws.com:5901`. You should get prompted for a password- The current AWS EC2 url is in 1Password, otherwise use the password from the previous step.
6. At this point you should be able to see a desktop. If there isn't a terminal already open, open one up by clicking on Activities > Accessories > Terminal in the top left. After this step you should be in a terminal on the remote machine.
7. Run `sudo apt install curl` to install curl
8. Run `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash` to install nvm -- this command downloads a script and runs it. The script clones the nvm repository to ~/.nvm, and attempts to add the source lines from the snippet below to the bash profile file
   `export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")" [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm`
9. Run `source ~/.bashrc` so that the above changes take effect
10. Run `nvm install node` to install node using nvm
11. Navigate to the directory you want to clone the scraper into, and run `git clone https://github.com/boristopalov/github-scraper-puppeteer`
12. Navigate to `/server` with `cd server`
13. Run `npm install` to install dependencies
14. Next we need to set up a few environment variables, so run `vi .env` (or whichever text editor you want to use). the contents of this file can be found in 1Password. There is also a env.sample file for reference in the `/server` directory
15. Next we need to set up a file called exportConfig.yaml file, which is used by mongo when exporting records in the database. The contents of this file can also be found in 1Password, and it should have 2 of the same variables as the .env file. First type `cd src/export`, then `vi exportConfig.yaml` and copy-paste the content from 1Password into the file and save the file.
16. Finally type `cd ../..` to change back into the `/server` directory, and run `npm run server`. You should get an output like `server listening on port 8080`.
17. Set-up on the server-side is done, next we need to set up the client side. First we need to cd into the client directory so run `cd ../client`
18. Run `npm install` to install dependencies
19. By default our app uses port 3000. We want to use port 80 so that the user doesn’t have to add in the port number when navigating to the URL in a browser, like http://scraper.comm.tools:3000. So we can run the following command to redirect network traffic from port 80 to port 3000: `sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000`
    1. This way, you can just navigate to http://scraper.comm.tools
20. Next, run `npm run build` to create a /build folder
21. We want to serve this folder to users. To do that we can install serve, which serves static sites. To do this, run `npm install -g serve`
22. Finally, run `serve -s build`. You should now be able to access the website at http://scraper.comm.tools!
