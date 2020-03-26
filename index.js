require("dotenv").config();
const http = require('http');
const fs = require("fs");
const puppeteer = require('puppeteer');
const { Remarkable } = require('remarkable-typescript');

let token = process.env.REMARKABLE_TOKEN;

const server = http.createServer(async (req, res) => {
  const incomingURL = new URL(`http://localhost:8000${req.url}`);

  if (incomingURL.searchParams.get("website")) {
    const website = new URL(incomingURL.searchParams.get("website"));
    console.log(`Fetching '${website.toString()}'`);
    if (await sendPage(website)) {
      fs.readFile(__dirname + "/success.html", function (err,data) {
        if (err) {
          res.writeHead(404);
          res.end(JSON.stringify(err));
          return;
        }
        res.writeHead(200, {'Content-Type': 'text/html'});
        res.end(data);
      });
    } else {
      fs.readFile(__dirname + "/failure.html", function (err,data) {
        if (err) {
          res.writeHead(404);
          res.end(JSON.stringify(err));
          return;
        }
        res.writeHead(500, {'Content-Type': 'text/html'});
        res.end(data);
      });
    }
  }else {
    let url = req.url === "/" ? "/index.html": req.url;
    fs.readFile(__dirname + url || "/index.html", function (err,data) {
      if (err) {
        res.writeHead(404);
        res.end(JSON.stringify(err));
        return;
      }

      if (url.endsWith(".js")) {
        res.writeHead(200, {'Content-Type': 'application/javascript'});
      } else if (url.endsWith(".json")) {
        res.writeHead(200, {'Content-Type': 'application/json'});
      } else if (url.endsWith(".png")) {
        res.writeHead(200, {'Content-Type': 'image/png'});
      } else {
        res.writeHead(200, {'Content-Type': 'text/html'});
      }

      res.end(data);
    });
  }
});

server.listen(8000);

async function sendPage(website, tries = 0) {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.emulate(Object.assign({}, puppeteer.devices["iPad Pro"], { userAgent: "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)" }));
    await page.goto(website.toString(), { referer: "https://www.google.com/" });
    const title = await page.title()
    console.log("Page loaded. Title - " + title)

    await page.evaluate( function(){
      [...document.querySelectorAll('*')].forEach(node => {
        const pos = window.getComputedStyle(node).getPropertyValue("position");
        if (pos == "fixed" || pos == "sticky") {
          node.style.position = "unset";
        }
      })
    } );

    const myPDF = await page.pdf({ format: 'A3', margin: {top: 5, bottom: 5} });
    console.log("Saved to PDF")

    const client = new Remarkable({ token });
    await client.uploadPDF(title, myPDF);
    console.log("Uploaded to reMarkable");

    return true;
  } catch (ex) {
    console.log(ex);
    if (tries < 5) {
      return await sendPage(website, ++tries);
    } else {
      return false;
    }
  } finally {
    await browser.close();
  }
}
