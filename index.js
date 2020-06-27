require("dotenv").config();
const http = require('http');
const fs = require("fs");
const axios = require('axios');
const uuid4 = require('uuid4');
const puppeteer = require('puppeteer');
const JSZip = require('jszip');

const server = http.createServer(async (req, res) => {
  const incomingURL = new URL(`http://localhost:8000${req.url}`);

  if (incomingURL.searchParams.get("website")) {
    const website = new URL(incomingURL.searchParams.get("website"));
    console.log(`Fetching '${website.toString()}'`);

    let fn = sendPage;
    if (website.toString().endsWith(".pdf")) {
      fn = sendPDF;
    }
    if (website.toString().endsWith(".epub")) {
      fn = sendEpub;
    }

    if (await fn(website)) {
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
  } else {
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

async function sendPDF(website, tries = 0) {
  try {
    const response = await axios.get(website.toString(), {
      responseType: 'arraybuffer'
    })
    const title = website.toString().substring(website.toString().lastIndexOf("/")+1, website.toString().lastIndexOf("."))
    await sendToRemarkable(title, Buffer.from(response.data, 'binary'));

    return true;
  } catch (ex) {
    console.log(ex);
    if (tries < 5) {
      return await sendPDF(website, ++tries);
    } else {
      return false;
    }
  }
}

async function sendEpub(website, tries = 0) {
  try {
    const response = await axios.get(website.toString(), {
      responseType: 'arraybuffer'
    })
    const title = website.toString().substring(website.toString().lastIndexOf("/")+1, website.toString().lastIndexOf("."))
    await sendToRemarkable(title, Buffer.from(response.data, 'binary'), 'epub');

    return true;
  } catch (ex) {
    console.log(ex);
    if (tries < 5) {
      return await sendEpub(website, ++tries);
    } else {
      return false;
    }
  }
}

async function sendPage(website, tries = 0) {
  const browser = await puppeteer.launch({
    ignoreHTTPSErrors: true,
    executablePath: process.env.CHROMIUM_PATH,
    args: ['--disable-dev-shm-usage', '--no-sandbox']
  });
  try {
    const page = await browser.newPage();
    await page.goto(website.toString(), { referer: "https://www.google.com/" });
    const title = await page.title()
    console.log("Page loaded. Title - " + title)

    await page.addStyleTag({ content: `
    body {
      font-family: Helvetica, Georgia, serif;
      font-size: 20pt;
      line-height: 1.2em;
      background: none;
      color: black;
      text-align: left;
    }
    h1, h2, h3, h4, h5 {
      page-break-after: avoid;
      font-weight: bold;
      margin-top: 4px;
    }
    h2, h3, h4, h5 {
      padding-top: 16px;
    }
    b, strong {
      font-weight: bold;
    }
    u {
      text-decoration: underline;
    }
    i, em {
      font-style: italic;
    }
    table, figure, ul, img {
      page-break-inside: avoid;
    }
    a {
      color: black;
    }
    a:after {
      content: " [" attr(href) "] ";
      font-size: 0.7em;
    }
    a[href^="#"]:after, a[href^="/"]:after, a[href^="javascript:"]:after {
      content: "";
    }
    blockquote {
      margin: 10px 2px;
      line-height: 1.5em;
      border: 0;
      border-left: 8px solid grey;
      padding-left: 8px;
    }

    table {
      width: 100%;
      margin: 4px;
      border: 1px solid black;
    }
    table td, table th {
      border: 1px solid black;
      padding: 2px
    }
    table thead,  table thead th {
      font-weight: bold;
      border-bottom-width: 2px;
    }

    code {
      background: none !important;
      font-family: monospace;
    }

    pre {
      overflow: visible;
      white-space: pre-wrap;
    }

    ul li {
      list-style: disc !important;
      margin-left: 50px;
    }

    h1 {
      font-size: 1.7em;
    }

    p {
      margin-bottom: 12px;
    }

    header {
      margin-bottom: 14px;
      border-bottom: 8px solid black;
      text-align: center;
    }
    header blockquote {
      border: 0 !important;
    }

    /* SCP-Wiki */
    .creditRate,
    .collapsible-block-folded,
    .collapsible-block-unfolded-link,
    .footer-wikiwalk-nav,
    .licensebox,
    .translation_block,
    #u-author_block,
    .u-faq,
    .info-container,
    .diamond-part,
    [class*='licensebox'] {
      display: none !important;
    }
    .collapsible-block-unfolded {
      display: block !important;
    }

    .anom-bar-container {
      max-width: 80% !important;
      font-size: 10pt;
    }
    .anom-bar-container a:after {
      content: "" !important;
    }
    .disrupt-class:before,
    .disrupt-class:after,
    .risk-class:before,
    .risk-class:after,
    .anom-bar-container .main-class:before,
    .anom-bar-container .main-class:after {
      display: none !important;
      content: "" !important;
      border: none !important;
    }

    `});

    await page.evaluate(async () => {
      return await new Promise(resolve => {
        var REGEXPS={unlikelyCandidates:/-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,okMaybeItsACandidate:/and|article|body|column|content|main|shadow/i};function isNodeVisible(a){return(!a.style||"none"!=a.style.display)&&!a.hasAttribute("hidden")&&(!a.hasAttribute("aria-hidden")||"true"!=a.getAttribute("aria-hidden")||a.className&&a.className.indexOf&&-1!==a.className.indexOf("fallback-image"))}function isProbablyReaderable(a,b){b||(b=isNodeVisible);var c=a.querySelectorAll("p, pre"),d=a.querySelectorAll("div > br");if(d.length){var e=new Set(c);[].forEach.call(d,function(a){e.add(a.parentNode)}),c=Array.from(e)}var f=0;return[].some.call(c,function(a){if(!b(a))return!1;var c=a.className+" "+a.id;if(REGEXPS.unlikelyCandidates.test(c)&&!REGEXPS.okMaybeItsACandidate.test(c))return!1;if(a.matches("li p"))return!1;var d=a.textContent.trim().length;return!(140>d)&&(f+=Math.sqrt(d-140),!!(20<f))})}"object"==typeof exports&&(exports.isProbablyReaderable=isProbablyReaderable);
        function Readability(e,t){if(t&&t.documentElement)e=t,t=arguments[2];else if(!e||!e.documentElement)throw new Error("First argument to Readability constructor should be a document object.");t=t||{},this._doc=e,this._docJSDOMParser=this._doc.firstChild.__JSDOMParser__,this._articleTitle=null,this._articleByline=null,this._articleDir=null,this._articleSiteName=null,this._attempts=[],this._debug=!!t.debug,this._maxElemsToParse=t.maxElemsToParse||this.DEFAULT_MAX_ELEMS_TO_PARSE,this._nbTopCandidates=t.nbTopCandidates||this.DEFAULT_N_TOP_CANDIDATES,this._charThreshold=t.charThreshold||this.DEFAULT_CHAR_THRESHOLD,this._classesToPreserve=this.CLASSES_TO_PRESERVE.concat(t.classesToPreserve||[]),this._keepClasses=!!t.keepClasses,this._flags=this.FLAG_STRIP_UNLIKELYS|this.FLAG_WEIGHT_CLASSES|this.FLAG_CLEAN_CONDITIONALLY;var a;this._debug?(a=function(t){var e=t.nodeName+" ";if(t.nodeType==t.TEXT_NODE)return e+"(\""+t.textContent+"\")";var a=t.className&&"."+t.className.replace(/ /g,"."),n="";return t.id?n="(#"+t.id+a+")":a&&(n="("+a+")"),e+n},this.log=function(){if("undefined"!=typeof dump){var e=Array.prototype.map.call(arguments,function(e){return e&&e.nodeName?a(e):e}).join(" ");dump("Reader: (Readability) "+e+"\n")}else if("undefined"!=typeof console){var t=["Reader: (Readability) "].concat(arguments);console.log.apply(console,t)}}):this.log=function(){}}Readability.prototype={FLAG_STRIP_UNLIKELYS:1,FLAG_WEIGHT_CLASSES:2,FLAG_CLEAN_CONDITIONALLY:4,ELEMENT_NODE:1,TEXT_NODE:3,DEFAULT_MAX_ELEMS_TO_PARSE:0,DEFAULT_N_TOP_CANDIDATES:5,DEFAULT_TAGS_TO_SCORE:"section,h2,h3,h4,h5,h6,p,td,pre".toUpperCase().split(","),DEFAULT_CHAR_THRESHOLD:500,REGEXPS:{unlikelyCandidates:/-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,okMaybeItsACandidate:/and|article|body|column|content|main|shadow|page-content/i,positive:/article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story|page-content/i,negative:/hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,extraneous:/print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,byline:/byline|author|dateline|writtenby|p-author/i,replaceFonts:/<(\/?)font[^>]*>/gi,normalize:/\s{2,}/g,videos:/\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,shareElements:/(\b|_)(share|sharedaddy)(\b|_)/i,nextLink:/(next|weiter|continue|>([^\|]|$)|Â»([^\|]|$))/i,prevLink:/(prev|earl|old|new|<|Â«)/i,whitespace:/^\s*$/,hasContent:/\S$/,srcsetUrl:/(\S+)(\s+[\d.]+[xw])?(\s*(?:,|$))/g,b64DataUrl:/^data:\s*([^\s;,]+)\s*;\s*base64\s*,/i},DIV_TO_P_ELEMS:["A","BLOCKQUOTE","DL","DIV","IMG","OL","P","PRE","TABLE","UL","SELECT"],ALTER_TO_DIV_EXCEPTIONS:["DIV","ARTICLE","SECTION","P"],PRESENTATIONAL_ATTRIBUTES:["align","background","bgcolor","border","cellpadding","cellspacing","frame","hspace","rules","style","valign","vspace"],DEPRECATED_SIZE_ATTRIBUTE_ELEMS:["TABLE","TH","TD","HR","PRE"],PHRASING_ELEMS:["ABBR","AUDIO","B","BDO","BR","BUTTON","CITE","CODE","DATA","DATALIST","DFN","EM","EMBED","I","IMG","INPUT","KBD","LABEL","MARK","MATH","METER","NOSCRIPT","OBJECT","OUTPUT","PROGRESS","Q","RUBY","SAMP","SCRIPT","SELECT","SMALL","SPAN","STRONG","SUB","SUP","TEXTAREA","TIME","VAR","WBR"],CLASSES_TO_PRESERVE:["page"],HTML_ESCAPE_MAP:{lt:"<",gt:">",amp:"&",quot:"\"",apos:"'"},_postProcessContent:function(e){this._fixRelativeUris(e),this._keepClasses||this._cleanClasses(e)},_removeNodes:function(e,t){if(this._docJSDOMParser&&e._isLiveNodeList)throw new Error("Do not pass live node lists to _removeNodes");for(var a=e.length-1;0<=a;a--){var n=e[a],l=n.parentNode;l&&(!t||t.call(this,n,a,e))&&l.removeChild(n)}},_replaceNodeTags:function(e,t){if(this._docJSDOMParser&&e._isLiveNodeList)throw new Error("Do not pass live node lists to _replaceNodeTags");for(var a,n=e.length-1;0<=n;n--)a=e[n],this._setNodeTag(a,t)},_forEachNode:function(e,t){Array.prototype.forEach.call(e,t,this)},_someNode:function(e,t){return Array.prototype.some.call(e,t,this)},_everyNode:function(e,t){return Array.prototype.every.call(e,t,this)},_concatNodeLists:function(){var e=Array.prototype.slice,t=e.call(arguments),a=t.map(function(t){return e.call(t)});return Array.prototype.concat.apply([],a)},_getAllNodesWithTag:function(e,t){return e.querySelectorAll?e.querySelectorAll(t.join(",")):[].concat.apply([],t.map(function(t){var a=e.getElementsByTagName(t);return Array.isArray(a)?a:Array.from(a)}))},_cleanClasses:function(e){var t=this._classesToPreserve,a=(e.getAttribute("class")||"").split(/\s+/).filter(function(e){return-1!=t.indexOf(e)}).join(" ");for(a?e.setAttribute("class",a):e.removeAttribute("class"),e=e.firstElementChild;e;e=e.nextElementSibling)this._cleanClasses(e)},_fixRelativeUris:function(e){function t(e){if(a==n&&"#"==e.charAt(0))return e;try{return new URL(e,a).href}catch(e){}return e}var a=this._doc.baseURI,n=this._doc.documentURI,i=this._getAllNodesWithTag(e,["a"]);this._forEachNode(i,function(e){var a=e.getAttribute("href");if(a)if(0!==a.indexOf("javascript:"))e.setAttribute("href",t(a));else if(1===e.childNodes.length&&e.childNodes[0].nodeType===this.TEXT_NODE){var n=this._doc.createTextNode(e.textContent);e.parentNode.replaceChild(n,e)}else{for(var i=this._doc.createElement("span");0<e.childNodes.length;)i.appendChild(e.childNodes[0]);e.parentNode.replaceChild(i,e)}});var l=this._getAllNodesWithTag(e,["img","picture","figure","video","audio","source"]);this._forEachNode(l,function(e){var a=e.getAttribute("src"),n=e.getAttribute("poster"),i=e.getAttribute("srcset");if(a&&e.setAttribute("src",t(a)),n&&e.setAttribute("poster",t(n)),i){var l=i.replace(this.REGEXPS.srcsetUrl,function(e,a,n,i){return t(a)+(n||"")+i});e.setAttribute("srcset",l)}})},_getArticleTitle:function(){function e(e){return e.split(/\s+/).length}var t=this._doc,a="",n="";try{a=n=t.title.trim(),"string"!=typeof a&&(a=n=this._getInnerText(t.getElementsByTagName("title")[0]))}catch(t){}var i=!1;if(/ [\|\-\\\/>Â»] /.test(a))i=/ [\\\/>Â»] /.test(a),a=n.replace(/(.*)[\|\-\\\/>Â»] .*/gi,"$1"),3>e(a)&&(a=n.replace(/[^\|\-\\\/>Â»]*[\|\-\\\/>Â»](.*)/gi,"$1"));else if(-1!==a.indexOf(": ")){var l=this._concatNodeLists(t.getElementsByTagName("h1"),t.getElementsByTagName("h2")),r=a.trim(),d=this._someNode(l,function(e){return e.textContent.trim()===r});d||(a=n.substring(n.lastIndexOf(":")+1),3>e(a)?a=n.substring(n.indexOf(":")+1):5<e(n.substr(0,n.indexOf(":")))&&(a=n))}else if(150<a.length||15>a.length){var o=t.getElementsByTagName("h1");1===o.length&&(a=this._getInnerText(o[0]))}a=a.trim().replace(this.REGEXPS.normalize," ");var s=e(a);return 4>=s&&(!i||s!=e(n.replace(/[\|\-\\\/>Â»]+/g,""))-1)&&(a=n),a},_prepDocument:function(){var e=this._doc;this._removeNodes(this._getAllNodesWithTag(e,["style"])),e.body&&this._replaceBrs(e.body),this._replaceNodeTags(this._getAllNodesWithTag(e,["font"]),"SPAN")},_nextElement:function(e){for(var t=e;t&&t.nodeType!=this.ELEMENT_NODE&&this.REGEXPS.whitespace.test(t.textContent);)t=t.nextSibling;return t},_replaceBrs:function(e){this._forEachNode(this._getAllNodesWithTag(e,["br"]),function(e){for(var t=e.nextSibling,a=!1;(t=this._nextElement(t))&&"BR"==t.tagName;){a=!0;var n=t.nextSibling;t.parentNode.removeChild(t),t=n}if(a){var i=this._doc.createElement("p");for(e.parentNode.replaceChild(i,e),t=i.nextSibling;t;){if("BR"==t.tagName){var l=this._nextElement(t.nextSibling);if(l&&"BR"==l.tagName)break}if(!this._isPhrasingContent(t))break;var r=t.nextSibling;i.appendChild(t),t=r}for(;i.lastChild&&this._isWhitespace(i.lastChild);)i.removeChild(i.lastChild);"P"===i.parentNode.tagName&&this._setNodeTag(i.parentNode,"DIV")}})},_setNodeTag:function(e,t){if(this.log("_setNodeTag",e,t),this._docJSDOMParser)return e.localName=t.toLowerCase(),e.tagName=t.toUpperCase(),e;for(var a=e.ownerDocument.createElement(t);e.firstChild;)a.appendChild(e.firstChild);e.parentNode.replaceChild(a,e),e.readability&&(a.readability=e.readability);for(var n=0;n<e.attributes.length;n++)try{a.setAttribute(e.attributes[n].name,e.attributes[n].value)}catch(e){}return a},_prepArticle:function(e){this._cleanStyles(e),this._markDataTables(e),this._fixLazyImages(e),this._cleanConditionally(e,"form"),this._cleanConditionally(e,"fieldset"),this._clean(e,"object"),this._clean(e,"embed"),this._clean(e,"h1"),this._clean(e,"footer"),this._clean(e,"link"),this._clean(e,"aside");var t=this.DEFAULT_CHAR_THRESHOLD;this._forEachNode(e.children,function(e){this._cleanMatchedNodes(e,function(e,a){return this.REGEXPS.shareElements.test(a)&&e.textContent.length<t})});var a=e.getElementsByTagName("h2");if(1===a.length){var n=(a[0].textContent.length-this._articleTitle.length)/this._articleTitle.length;if(.5>Math.abs(n)){var i=!1;i=0<n?a[0].textContent.includes(this._articleTitle):this._articleTitle.includes(a[0].textContent),i&&this._clean(e,"h2")}}this._clean(e,"iframe"),this._clean(e,"input"),this._clean(e,"textarea"),this._clean(e,"select"),this._clean(e,"button"),this._cleanHeaders(e),this._cleanConditionally(e,"table"),this._cleanConditionally(e,"ul"),this._cleanConditionally(e,"div"),this._removeNodes(this._getAllNodesWithTag(e,["p"]),function(e){var t=e.getElementsByTagName("img").length,a=e.getElementsByTagName("embed").length,n=e.getElementsByTagName("object").length,i=e.getElementsByTagName("iframe").length;return 0===t+a+n+i&&!this._getInnerText(e,!1)}),this._forEachNode(this._getAllNodesWithTag(e,["br"]),function(e){var t=this._nextElement(e.nextSibling);t&&"P"==t.tagName&&e.parentNode.removeChild(e)}),this._forEachNode(this._getAllNodesWithTag(e,["table"]),function(e){var t=this._hasSingleTagInsideElement(e,"TBODY")?e.firstElementChild:e;if(this._hasSingleTagInsideElement(t,"TR")){var a=t.firstElementChild;if(this._hasSingleTagInsideElement(a,"TD")){var n=a.firstElementChild;n=this._setNodeTag(n,this._everyNode(n.childNodes,this._isPhrasingContent)?"P":"DIV"),e.parentNode.replaceChild(n,e)}}})},_initializeNode:function(e){switch(e.readability={contentScore:0},e.tagName){case"DIV":e.readability.contentScore+=5;break;case"PRE":case"TD":case"BLOCKQUOTE":e.readability.contentScore+=3;break;case"ADDRESS":case"OL":case"UL":case"DL":case"DD":case"DT":case"LI":case"FORM":e.readability.contentScore-=3;break;case"H1":case"H2":case"H3":case"H4":case"H5":case"H6":case"TH":e.readability.contentScore-=5;}e.readability.contentScore+=this._getClassWeight(e)},_removeAndGetNext:function(e){var t=this._getNextNode(e,!0);return e.parentNode.removeChild(e),t},_getNextNode:function(e,t){if(!t&&e.firstElementChild)return e.firstElementChild;if(e.nextElementSibling)return e.nextElementSibling;do e=e.parentNode;while(e&&!e.nextElementSibling);return e&&e.nextElementSibling},_checkByline:function(e,t){if(this._articleByline)return!1;if(void 0!==e.getAttribute)var a=e.getAttribute("rel"),n=e.getAttribute("itemprop");return!!(("author"===a||n&&-1!==n.indexOf("author")||this.REGEXPS.byline.test(t))&&this._isValidByline(e.textContent))&&(this._articleByline=e.textContent.trim(),!0)},_getNodeAncestors:function(e,t){t=t||0;for(var a=0,n=[];e.parentNode&&(n.push(e.parentNode),!(t&&++a===t));)e=e.parentNode;return n},_grabArticle:function(e){this.log("**** grabArticle ****");var a=this._doc,n=null!==e;if(e=e?e:this._doc.body,!e)return this.log("No body found in document. Abort."),null;for(var l=e.innerHTML;;){for(var r,d=this._flagIsActive(this.FLAG_STRIP_UNLIKELYS),o=[],g=this._doc.documentElement;g;){if(r=g.className+" "+g.id,!this._isProbablyVisible(g)){this.log("Removing hidden node - "+r),g=this._removeAndGetNext(g);continue}if(this._checkByline(g,r)){g=this._removeAndGetNext(g);continue}if(d){if(this.REGEXPS.unlikelyCandidates.test(r)&&!this.REGEXPS.okMaybeItsACandidate.test(r)&&!this._hasAncestorTag(g,"table")&&"BODY"!==g.tagName&&"A"!==g.tagName){this.log("Removing unlikely candidate - "+r),g=this._removeAndGetNext(g);continue}if("complementary"==g.getAttribute("role")){this.log("Removing complementary content - "+r),g=this._removeAndGetNext(g);continue}}if(("DIV"===g.tagName||"SECTION"===g.tagName||"HEADER"===g.tagName||"H1"===g.tagName||"H2"===g.tagName||"H3"===g.tagName||"H4"===g.tagName||"H5"===g.tagName||"H6"===g.tagName)&&this._isElementWithoutContent(g)){g=this._removeAndGetNext(g);continue}if(-1!==this.DEFAULT_TAGS_TO_SCORE.indexOf(g.tagName)&&o.push(g),"DIV"===g.tagName){for(var _,m=null,N=g.firstChild;N;){if(_=N.nextSibling,this._isPhrasingContent(N))null===m?!this._isWhitespace(N)&&(m=a.createElement("p"),g.replaceChild(m,N),m.appendChild(N)):m.appendChild(N);else if(null!==m){for(;m.lastChild&&this._isWhitespace(m.lastChild);)m.removeChild(m.lastChild);m=null}N=_}if(this._hasSingleTagInsideElement(g,"P")&&.25>this._getLinkDensity(g)){var E=g.children[0];g.parentNode.replaceChild(E,g),g=E,o.push(g)}else this._hasChildBlockElement(g)||(g=this._setNodeTag(g,"P"),o.push(g))}g=this._getNextNode(g)}var h=[];this._forEachNode(o,function(e){if(e.parentNode&&"undefined"!=typeof e.parentNode.tagName){var t=this._getInnerText(e);if(!(25>t.length)){var a=this._getNodeAncestors(e,3);if(0!==a.length){var n=0;n+=1,n+=t.split(",").length,n+=Math.min(Math.floor(t.length/100),3),this._forEachNode(a,function(e,t){if(e.tagName&&e.parentNode&&"undefined"!=typeof e.parentNode.tagName){if("undefined"==typeof e.readability&&(this._initializeNode(e),h.push(e)),0===t)var a=1;else a=1===t?2:3*t;e.readability.contentScore+=n/a}})}}}});for(var T=[],u=0,b=h.length;u<b;u+=1){var A=h[u],C=A.readability.contentScore*(1-this._getLinkDensity(A));A.readability.contentScore=C,this.log("Candidate:",A,"with score "+C);for(var S,y=0;y<this._nbTopCandidates;y++)if(S=T[y],!S||C>S.readability.contentScore){T.splice(y,0,A),T.length>this._nbTopCandidates&&T.pop();break}}var f,L=T[0]||null,I=!1;if(null===L||"BODY"===L.tagName){L=a.createElement("DIV"),I=!0;for(var D=e.childNodes;D.length;)this.log("Moving child out:",D[0]),L.appendChild(D[0]);e.appendChild(L),this._initializeNode(L)}else if(L){for(var x=[],R=1;R<T.length;R++).75<=T[R].readability.contentScore/L.readability.contentScore&&x.push(this._getNodeAncestors(T[R]));if(3<=x.length)for(f=L.parentNode;"BODY"!==f.tagName;){for(var v=0,P=0;P<x.length&&3>v;P++)v+=+x[P].includes(f);if(3<=v){L=f;break}f=f.parentNode}L.readability||this._initializeNode(L),f=L.parentNode;for(var O=L.readability.contentScore,B=O/3;"BODY"!==f.tagName;){if(!f.readability){f=f.parentNode;continue}var G=f.readability.contentScore;if(G<B)break;if(G>O){L=f;break}O=f.readability.contentScore,f=f.parentNode}for(f=L.parentNode;"BODY"!=f.tagName&&1==f.children.length;)L=f,f=L.parentNode;L.readability||this._initializeNode(L)}var M=a.createElement("DIV");n&&(M.id="readability-content");var H=Math.max(10,.2*L.readability.contentScore);f=L.parentNode;for(var U=f.children,F=0,W=U.length;F<W;F++){var X=U[F],w=!1;if(this.log("Looking at sibling node:",X,X.readability?"with score "+X.readability.contentScore:""),this.log("Sibling has score",X.readability?X.readability.contentScore:"Unknown"),X===L)w=!0;else{var k=0;if(X.className===L.className&&""!==L.className&&(k+=.2*L.readability.contentScore),X.readability&&X.readability.contentScore+k>=H)w=!0;else if("P"===X.nodeName){var V=this._getLinkDensity(X),Y=this._getInnerText(X),j=Y.length;80<j&&.25>V?w=!0:80>j&&0<j&&0===V&&-1!==Y.search(/\.( |$)/)&&(w=!0)}}w&&(this.log("Appending node:",X),-1===this.ALTER_TO_DIV_EXCEPTIONS.indexOf(X.nodeName)&&(this.log("Altering sibling:",X,"to div."),X=this._setNodeTag(X,"DIV")),M.appendChild(X),F-=1,W-=1)}if(this._debug&&this.log("Article content pre-prep: "+M.innerHTML),this._prepArticle(M),this._debug&&this.log("Article content post-prep: "+M.innerHTML),I)L.id="readability-page-1",L.className="page";else{var z=a.createElement("DIV");z.id="readability-page-1",z.className="page";for(var K=M.childNodes;K.length;)z.appendChild(K[0]);M.appendChild(z)}this._debug&&this.log("Article content after paging: "+M.innerHTML);var J=!0,q=this._getInnerText(M,!0).length;if(q<this._charThreshold)if(J=!1,e.innerHTML=l,this._flagIsActive(this.FLAG_STRIP_UNLIKELYS))this._removeFlag(this.FLAG_STRIP_UNLIKELYS),this._attempts.push({articleContent:M,textLength:q});else if(this._flagIsActive(this.FLAG_WEIGHT_CLASSES))this._removeFlag(this.FLAG_WEIGHT_CLASSES),this._attempts.push({articleContent:M,textLength:q});else if(this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY))this._removeFlag(this.FLAG_CLEAN_CONDITIONALLY),this._attempts.push({articleContent:M,textLength:q});else{if(this._attempts.push({articleContent:M,textLength:q}),this._attempts.sort(function(e,t){return t.textLength-e.textLength}),!this._attempts[0].textLength)return null;M=this._attempts[0].articleContent,J=!0}if(J){var Q=[f,L].concat(this._getNodeAncestors(f));return this._someNode(Q,function(e){if(!e.tagName)return!1;var t=e.getAttribute("dir");return!!t&&(this._articleDir=t,!0)}),M}}},_isValidByline:function(e){return!!("string"==typeof e||e instanceof String)&&(e=e.trim(),0<e.length&&100>e.length)},_unescapeHtmlEntities:function(e){if(!e)return e;var t=this.HTML_ESCAPE_MAP;return e.replace(/&(quot|amp|apos|lt|gt);/g,function(e,a){return t[a]}).replace(/&#(?:x([0-9a-z]{1,4})|([0-9]{1,4}));/gi,function(e,t,a){var n=parseInt(t||a,t?16:10);return String.fromCharCode(n)})},_getArticleMetadata:function(){var e={},t={},a=this._doc.getElementsByTagName("meta");return this._forEachNode(a,function(e){var a=e.getAttribute("name"),n=e.getAttribute("property"),l=e.getAttribute("content");if(l){var r=null,d=null;if(n&&(r=n.match(/\s*(dc|dcterm|og|twitter)\s*:\s*(author|creator|description|title|site_name)\s*/gi),r))for(var o=r.length-1;0<=o;o--)d=r[o].toLowerCase().replace(/\s/g,""),t[d]=l.trim();!r&&a&&/^\s*(?:(dc|dcterm|og|twitter|weibo:(article|webpage))\s*[\.:]\s*)?(author|creator|description|title|site_name)\s*$/i.test(a)&&(d=a,l&&(d=d.toLowerCase().replace(/\s/g,"").replace(/\./g,":"),t[d]=l.trim()))}}),e.title=t["dc:title"]||t["dcterm:title"]||t["og:title"]||t["weibo:article:title"]||t["weibo:webpage:title"]||t.title||t["twitter:title"],e.title||(e.title=this._getArticleTitle()),e.byline=t["dc:creator"]||t["dcterm:creator"]||t.author,e.excerpt=t["dc:description"]||t["dcterm:description"]||t["og:description"]||t["weibo:article:description"]||t["weibo:webpage:description"]||t.description||t["twitter:description"],e.siteName=t["og:site_name"],e.title=this._unescapeHtmlEntities(e.title),e.byline=this._unescapeHtmlEntities(e.byline),e.excerpt=this._unescapeHtmlEntities(e.excerpt),e.siteName=this._unescapeHtmlEntities(e.siteName),e},_isSingleImage:function(e){return!("IMG"!==e.tagName)||1===e.children.length&&""===e.textContent.trim()&&this._isSingleImage(e.children[0])},_unwrapNoscriptImages:function(e){var t=Array.from(e.getElementsByTagName("img"));this._forEachNode(t,function(e){for(var t,a=0;a<e.attributes.length;a++){switch(t=e.attributes[a],t.name){case"src":case"srcset":case"data-src":case"data-srcset":return;}if(/\.(jpg|jpeg|png|webp)/i.test(t.value))return}e.parentNode.removeChild(e)});var a=Array.from(e.getElementsByTagName("noscript"));this._forEachNode(a,function(t){var a=e.createElement("div");if(a.innerHTML=t.innerHTML,!!this._isSingleImage(a)){var n=t.previousElementSibling;if(n&&this._isSingleImage(n)){var l=n;"IMG"!==l.tagName&&(l=n.getElementsByTagName("img")[0]);for(var r,d=a.getElementsByTagName("img")[0],o=0;o<l.attributes.length;o++)if((r=l.attributes[o],""!==r.value)&&("src"===r.name||"srcset"===r.name||/\.(jpg|jpeg|png|webp)/i.test(r.value))){if(d.getAttribute(r.name)===r.value)continue;var s=r.name;d.hasAttribute(s)&&(s="data-old-"+s),d.setAttribute(s,r.value)}t.parentNode.replaceChild(a.firstElementChild,n)}}})},_removeScripts:function(e){this._removeNodes(this._getAllNodesWithTag(e,["script"]),function(e){return e.nodeValue="",e.removeAttribute("src"),!0}),this._removeNodes(this._getAllNodesWithTag(e,["noscript"]))},_hasSingleTagInsideElement:function(e,t){return 1==e.children.length&&e.children[0].tagName===t&&!this._someNode(e.childNodes,function(e){return e.nodeType===this.TEXT_NODE&&this.REGEXPS.hasContent.test(e.textContent)})},_isElementWithoutContent:function(e){return e.nodeType===this.ELEMENT_NODE&&0==e.textContent.trim().length&&(0==e.children.length||e.children.length==e.getElementsByTagName("br").length+e.getElementsByTagName("hr").length)},_hasChildBlockElement:function(e){return this._someNode(e.childNodes,function(e){return-1!==this.DIV_TO_P_ELEMS.indexOf(e.tagName)||this._hasChildBlockElement(e)})},_isPhrasingContent:function(e){return e.nodeType===this.TEXT_NODE||-1!==this.PHRASING_ELEMS.indexOf(e.tagName)||("A"===e.tagName||"DEL"===e.tagName||"INS"===e.tagName)&&this._everyNode(e.childNodes,this._isPhrasingContent)},_isWhitespace:function(e){return e.nodeType===this.TEXT_NODE&&0===e.textContent.trim().length||e.nodeType===this.ELEMENT_NODE&&"BR"===e.tagName},_getInnerText:function(t,e){e=!("undefined"!=typeof e)||e;var a=t.textContent.trim();return e?a.replace(this.REGEXPS.normalize," "):a},_getCharCount:function(t,e){return e=e||",",this._getInnerText(t).split(e).length-1},_cleanStyles:function(t){if(t&&"svg"!==t.tagName.toLowerCase()){for(var e=0;e<this.PRESENTATIONAL_ATTRIBUTES.length;e++)t.removeAttribute(this.PRESENTATIONAL_ATTRIBUTES[e]);-1!==this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS.indexOf(t.tagName)&&(t.removeAttribute("width"),t.removeAttribute("height"));for(var a=t.firstElementChild;null!==a;)this._cleanStyles(a),a=a.nextElementSibling}},_getLinkDensity:function(e){var t=this._getInnerText(e).length;if(0===t)return 0;var a=0;return this._forEachNode(e.getElementsByTagName("a"),function(e){a+=this._getInnerText(e).length}),a/t},_getClassWeight:function(t){if(!this._flagIsActive(this.FLAG_WEIGHT_CLASSES))return 0;var e=0;return"string"==typeof t.className&&""!==t.className&&(this.REGEXPS.negative.test(t.className)&&(e-=25),this.REGEXPS.positive.test(t.className)&&(e+=25)),"string"==typeof t.id&&""!==t.id&&(this.REGEXPS.negative.test(t.id)&&(e-=25),this.REGEXPS.positive.test(t.id)&&(e+=25)),e},_clean:function(t,e){var a=-1!==["object","embed","iframe"].indexOf(e);this._removeNodes(this._getAllNodesWithTag(t,[e]),function(e){if(a){for(var t=0;t<e.attributes.length;t++)if(this.REGEXPS.videos.test(e.attributes[t].value))return!1;if("object"===e.tagName&&this.REGEXPS.videos.test(e.innerHTML))return!1}return!0})},_hasAncestorTag:function(e,t,a,n){a=a||3,t=t.toUpperCase();for(var i=0;e.parentNode;){if(0<a&&i>a)return!1;if(e.parentNode.tagName===t&&(!n||n(e.parentNode)))return!0;e=e.parentNode,i++}return!1},_getRowAndColumnCount:function(e){for(var t,a=0,n=0,l=e.getElementsByTagName("tr"),r=0;r<l.length;r++){t=l[r].getAttribute("rowspan")||0,t&&(t=parseInt(t,10)),a+=t||1;for(var d,o=0,s=l[r].getElementsByTagName("td"),g=0;g<s.length;g++)d=s[g].getAttribute("colspan")||0,d&&(d=parseInt(d,10)),o+=d||1;n=Math.max(n,o)}return{rows:a,columns:n}},_markDataTables:function(e){for(var t=e.getElementsByTagName("table"),a=0;a<t.length;a++){var n=t[a],l=n.getAttribute("role");if("presentation"==l){n._readabilityDataTable=!1;continue}var r=n.getAttribute("datatable");if("0"==r){n._readabilityDataTable=!1;continue}var d=n.getAttribute("summary");if(d){n._readabilityDataTable=!0;continue}var o=n.getElementsByTagName("caption")[0];if(o&&0<o.childNodes.length){n._readabilityDataTable=!0;continue}var s=function(e){return!!n.getElementsByTagName(e)[0]};if(["col","colgroup","tfoot","thead","th"].some(s)){this.log("Data table because found data-y descendant"),n._readabilityDataTable=!0;continue}if(n.getElementsByTagName("table")[0]){n._readabilityDataTable=!1;continue}var g=this._getRowAndColumnCount(n);if(10<=g.rows||4<g.columns){n._readabilityDataTable=!0;continue}n._readabilityDataTable=10<g.rows*g.columns}},_fixLazyImages:function(e){this._forEachNode(this._getAllNodesWithTag(e,["img","picture","figure"]),function(e){if(e.src&&this.REGEXPS.b64DataUrl.test(e.src)){var t=this.REGEXPS.b64DataUrl.exec(e.src);if("image/svg+xml"===t[1])return;for(var a,n=!1,l=0;l<e.attributes.length;l++)if((a=e.attributes[l],"src"!==a.name)&&/\.(jpg|jpeg|png|webp)/i.test(a.value)){n=!0;break}if(n){var r=e.src.search(/base64\s*/i)+7,d=e.src.length-r;133>d&&e.removeAttribute("src")}}if(!((e.src||e.srcset&&"null"!=e.srcset)&&-1===e.className.toLowerCase().indexOf("lazy")))for(var o=0;o<e.attributes.length;o++)if(a=e.attributes[o],"src"!==a.name&&"srcset"!==a.name){var s=null;if(/\.(jpg|jpeg|png|webp)\s+\d/.test(a.value)?s="srcset":/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(a.value)&&(s="src"),s)if("IMG"===e.tagName||"PICTURE"===e.tagName)e.setAttribute(s,a.value);else if("FIGURE"===e.tagName&&!this._getAllNodesWithTag(e,["img","picture"]).length){var g=this._doc.createElement("img");g.setAttribute(s,a.value),e.appendChild(g)}}})},_cleanConditionally:function(t,e){if(this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)){var a="ul"===e||"ol"===e;this._removeNodes(this._getAllNodesWithTag(t,[e]),function(t){var n=function(e){return e._readabilityDataTable};if("table"===e&&n(t))return!1;if(this._hasAncestorTag(t,"table",-1,n))return!1;var l=this._getClassWeight(t);if(this.log("Cleaning Conditionally",t),0>l+0)return!0;if(10>this._getCharCount(t,",")){for(var r=t.getElementsByTagName("p").length,d=t.getElementsByTagName("img").length,o=t.getElementsByTagName("li").length-100,s=t.getElementsByTagName("input").length,g=0,c=this._getAllNodesWithTag(t,["object","embed","iframe"]),_=0;_<c.length;_++){for(var m=0;m<c[_].attributes.length;m++)if(this.REGEXPS.videos.test(c[_].attributes[m].value))return!1;if("object"===c[_].tagName&&this.REGEXPS.videos.test(c[_].innerHTML))return!1;g++}var N=this._getLinkDensity(t),E=this._getInnerText(t).length,h=1<d&&.5>r/d&&!this._hasAncestorTag(t,"figure")||!a&&o>r||s>Math.floor(r/3)||!a&&25>E&&(0===d||2<d)&&!this._hasAncestorTag(t,"figure")||!a&&25>l&&.2<N||25<=l&&.5<N||1===g&&75>E||1<g;return h}return!1})}},_cleanMatchedNodes:function(t,e){for(var a=this._getNextNode(t,!0),n=this._getNextNode(t);n&&n!=a;)n=e.call(this,n,n.className+" "+n.id)?this._removeAndGetNext(n):this._getNextNode(n)},_cleanHeaders:function(t){this._removeNodes(this._getAllNodesWithTag(t,["h1","h2"]),function(e){return 0>this._getClassWeight(e)})},_flagIsActive:function(e){return 0<(this._flags&e)},_removeFlag:function(e){this._flags&=~e},_isProbablyVisible:function(e){return(!e.style||"none"!=e.style.display)&&!e.hasAttribute("hidden")&&(!e.hasAttribute("aria-hidden")||"true"!=e.getAttribute("aria-hidden")||e.className&&e.className.indexOf&&-1!==e.className.indexOf("fallback-image"))},parse:function(){if(0<this._maxElemsToParse){var e=this._doc.getElementsByTagName("*").length;if(e>this._maxElemsToParse)throw new Error("Aborting parsing document; "+e+" elements found")}this._unwrapNoscriptImages(this._doc),this._removeScripts(this._doc),this._prepDocument();var t=this._getArticleMetadata();this._articleTitle=t.title;var a=this._grabArticle();if(!a)return null;if(this.log("Grabbed: "+a.innerHTML),this._postProcessContent(a),!t.excerpt){var n=a.getElementsByTagName("p");0<n.length&&(t.excerpt=n[0].textContent.trim())}var i=a.textContent;return{title:this._articleTitle,byline:t.byline||this._articleByline,dir:this._articleDir,content:a.innerHTML,textContent:i,length:i.length,excerpt:t.excerpt,siteName:t.siteName||this._articleSiteName}}},"object"==typeof module&&(module.exports=Readability);

        // Fix all `/...` type links
        [...document.querySelectorAll('a[href^="/"]')].forEach(node => node.href = node.href);

        // Remove medium blur images
        [...document.querySelectorAll('img[src^="https://miro.medium.com/max/60/"]')].forEach(node => node.style.display = "none")

        if (window.location.hostname.includes("scp-wiki")) {
          if (document.querySelector('.collapsible-block-unfolded')) {
            document.querySelector('.collapsible-block-unfolded').style.display = "block";
          }
          if (document.querySelector('.page-rate-widget-box')) {
            document.querySelector('.page-rate-widget-box').style.display = "none";
          }

          [...document.querySelectorAll('a.footnoteref')].forEach(ref => {
            ref.innerText = document.getElementById(ref.id.replace("ref", "")).innerText;
          });

          document.body.innerHTML = `<h1>${document.getElementById('page-title').innerHTML}</h1>` + document.getElementById('page-content').innerHTML;
        } else if (isProbablyReaderable(document.cloneNode(true))) {
          var documentClone = document.cloneNode(true);
          var article = new Readability(documentClone).parse();
          var postedDate = document.querySelector('time[datetime]');
          var content = `
            <header>
              <h1>${article.title}</h1>
              ${article.byline ? `<blockquote>${article.byline}</blockquote>` : ""}
              ${postedDate && postedDate.getAttribute('datetime') ? `<blockquote>${postedDate.getAttribute('datetime')}</blockquote>` : ""}
            </header>
            ` + article.content;
          document.body.innerHTML = content;
        }

        [...document.querySelectorAll('details')].forEach(details => details.setAttribute('open', ''));

        [...document.querySelectorAll('*')].forEach(node => {
          const pos = window.getComputedStyle(node).getPropertyValue("position");
          if (pos == "fixed" || pos == "sticky") {
            node.style.position = "unset";
          }
        });

        var im = document.createElement("img");
        im.src = `https://qr.cluster.fun/?website=${window.location.toString()}`;
        im.style = "position:absolute;top:0;right:0;z-index:99999999";
        im.onload = resolve;
        im.onerror = () => {
          document.body.removeChild(im);
          resolve();
        }
        document.body.appendChild(im);
      })
    });

    const myPDF = await page.pdf({ format: 'A4', margin: {top: 40, bottom: 40, left: 40, right: 40} });
    console.log("Saved to PDF")

    if (process.env.DEBUG == "true") {
      fs.writeFileSync(title+'.pdf', myPDF);
    } else {
      await sendToRemarkable(title, myPDF);
    }

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

async function sendToRemarkable(title, myPDF, fileType = "pdf") {
  try {
    // Refresh token
    let response = await axios.post(
      "https://my.remarkable.com/token/json/2/user/new",
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.REMARKABLE_TOKEN}`,
        },
      }
    );
    let token = response.data;
    console.log(`Refreshed token: ${token}`);

    // Get storage endpoint
    response = await axios.get(
      "https://service-manager-production-dot-remarkable-production.appspot.com/service/json/1/document-storage?environment=production&group=auth0%7C5a68dc51cb30df3877a1d7c4&apiVer=2",
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    let storageHost = response.data.Host;
    console.log(`Got storage host: ${storageHost}`);

    // Generate upload request
    const ID = uuid4();
    response = await axios.put(
      `https://${storageHost}/document-storage/json/2/upload/request`,
      [{
        "ID": ID,
        "Type": "DocumentType",
        "Version": 1
      }],
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    let uploadURL = response.data[0].BlobURLPut;
    console.log(`Got upload URL: ${uploadURL}`);

    // Build zip to upload
    let zip = new JSZip();
    zip.file(`${ID}.content`, JSON.stringify({
      extraMetadata: {},
      fileType: fileType,
      lastOpenedPage: 0,
      lineHeight: -1,
      margins: 180,
      pageCount: 0,
      textScale: 1,
      transform: {},
    }));
    zip.file(`${ID}.pagedata`, []);
    zip.file(`${ID}.${fileType}`, myPDF);
    const zipContent = await zip.generateAsync({ type: 'nodebuffer' });

    // Upload zip
    response = await axios.put(
      uploadURL,
      zipContent,
      {
        headers: {
          'Content-Type': '',
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    console.log("Uploaded");

    // Populate metadata
    response = await axios.put(
      `https://${storageHost}/document-storage/json/2/upload/update-status`,
      [{
        ID: ID,
        deleted: false,
        lastModified: new Date().toISOString(),
        ModifiedClient: new Date().toISOString(),
        metadatamodified: false,
        modified: false,
        parent: '',
        pinned: false,
        synced: true,
        type: "DocumentType",
        version: 1,
        VissibleName: title,
      }],
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      }
    );
    console.log("Upload complete")
  } catch (error) {
    console.error(error.response);
    throw error;
  }
}
