### Setting up a fresh copy (instructions are for Ubuntu)

1. First we need to set up the server. Instructions by Ashoat are in Linear.
2. Once that is set up, open up a terminal and ssh into the scraper machine. If you followed Ashoat’s instructions in the previous step, you should be able to do that with the following command: `ssh scraper`. All the following commands should be run on the remote machine through ssh
3. Run `sudo apt install curl` to install curl
4. Run `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash` to install nvm -- this command runs downloads a script and runs it. The script clones the nvm repository to ~/.nvm, and attempts to add the source lines from the snippet below to the bash profile file 
    `export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm`
5. Run `source ~/.bashrc` so that the above changes take effect
6. Run `nvm install node` to install node using nvm 
7. Navigate to the directory you want to clone the scraper into, and run `git clone https://github.com/boristopalov/github-scraper-puppeteer` 
8. Navigate to /server with `cd server`
9. Run `npm install` to install dependencies 
10. Next we need to set up a few environment variables, so run `vi .env` (or whichever text editor you want to use). the contents of this file can be found in 1Password. There is also a env.sample file for reference in the /server directory
11. Next we need to set up a file called exportConfig.yaml file, which is used by mongo when exporting records in the database. The contents of this file can also be found in 1Password, and it should have 2 of the same variables as the .env file. So run `vi exportConfig.yaml` and copy-paste the content from 1Password into the file and save the file.
12. Set-up on the server-side is down, next we need to set up the client side. First we need to cd into the client directory so run `cd ../client`
13. Run `npm install` to install dependencies
14. By default our app uses port 3000. We want to use port 80 so that the user doesn’t have to add in the port number when navigating to the URL in a browser, like http://scraper.comm.tools:3000. So we can run the following command to redirect network traffic from port 80 to port 3000: `sudo iptables -t nat -A PREROUTING -i eth0 -p tcp --dport 80 -j REDIRECT --to-port 3000`
    1. This way, you can just navigate to http://scraper.comm.tools
15. Next, run `npm run build` to create an optimized /build folder 
16. We want to serve this folder to users. To do that we can install serve, which serves static sites. To do this, run `npm install -g serve` 
17. Finally, run `serve -s build’.  You should now be able to access the website at `http://scraper.comm.tools`!


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

This is how you start the scraper. You can only have one instance of the scraper running at once. If the scraper is already running, running scrape again on a URL will only scrape that URL, and then quit. The original scraper will continue to run tasks from the queue. If the scraper is running, a button labeled “Stop Scraper” will appear in the top right.

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






