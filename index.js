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
      font-family: Georgia, serif;
      font-size: 18pt;
      background: none;
      color: black;
      text-align: left;
    }
    h1, h2, h3, h4, h5 {
      page-break-after: avoid;
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
    a[href^="#"]:after, a[href^="/"]:after {
      content: "";
    }
    blockquote {
      margin: 10px 2px;
      line-height: 2em;
      border: 0;
    }

    code {
      background: none !important;
      font-family: monospace;
    }

    ul li {
      list-style: disc !important;
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
    `});

    await page.evaluate(async () => {
      return await new Promise(resolve => {
        var REGEXPS={unlikelyCandidates:/-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,okMaybeItsACandidate:/and|article|body|column|content|main|shadow/i};function isNodeVisible(node){return(!node.style||node.style.display!="none")&&!node.hasAttribute("hidden")&&(!node.hasAttribute("aria-hidden")||node.getAttribute("aria-hidden")!="true"||(node.className&&node.className.indexOf&&node.className.indexOf("fallback-image")!==-1))}function isProbablyReaderable(doc,isVisible){if(!isVisible){isVisible=isNodeVisible}var nodes=doc.querySelectorAll("p, pre");var brNodes=doc.querySelectorAll("div > br");if(brNodes.length){var set=new Set(nodes);[].forEach.call(brNodes,function(node){set.add(node.parentNode)});nodes=Array.from(set)}var score=0;return[].some.call(nodes,function(node){if(!isVisible(node)){return false}var matchString=node.className+" "+node.id;if(REGEXPS.unlikelyCandidates.test(matchString)&&!REGEXPS.okMaybeItsACandidate.test(matchString)){return false}if(node.matches("li p")){return false}var textContentLength=node.textContent.trim().length;if(textContentLength<140){return false}score+=Math.sqrt(textContentLength-140);if(score>20){return true}return false})}if(typeof exports==="object"){exports.isProbablyReaderable=isProbablyReaderable}
        function Readability(doc,options){if(options&&options.documentElement){doc=options;options=arguments[2]}else if(!doc||!doc.documentElement){throw new Error("First argument to Readability constructor should be a document object.")}options=options||{};this._doc=doc;this._docJSDOMParser=this._doc.firstChild.__JSDOMParser__;this._articleTitle=null;this._articleByline=null;this._articleDir=null;this._articleSiteName=null;this._attempts=[];this._debug=!!options.debug;this._maxElemsToParse=options.maxElemsToParse||this.DEFAULT_MAX_ELEMS_TO_PARSE;this._nbTopCandidates=options.nbTopCandidates||this.DEFAULT_N_TOP_CANDIDATES;this._charThreshold=options.charThreshold||this.DEFAULT_CHAR_THRESHOLD;this._classesToPreserve=this.CLASSES_TO_PRESERVE.concat(options.classesToPreserve||[]);this._keepClasses=!!options.keepClasses;this._flags=this.FLAG_STRIP_UNLIKELYS|this.FLAG_WEIGHT_CLASSES|this.FLAG_CLEAN_CONDITIONALLY;var logEl;if(this._debug){logEl=function(e){var rv=e.nodeName+" ";if(e.nodeType==e.TEXT_NODE){return rv+'("'+e.textContent+'")'}var classDesc=e.className&&("."+e.className.replace(/ /g,"."));var elDesc="";if(e.id){elDesc="(#"+e.id+classDesc+")"}else if(classDesc){elDesc="("+classDesc+")"}return rv+elDesc};this.log=function(){if(typeof dump!=="undefined"){var msg=Array.prototype.map.call(arguments,function(x){return(x&&x.nodeName)?logEl(x):x}).join(" ");dump("Reader: (Readability) "+msg+"\n")}else if(typeof console!=="undefined"){var args=["Reader: (Readability) "].concat(arguments);console.log.apply(console,args)}}}else{this.log=function(){}}}Readability.prototype={FLAG_STRIP_UNLIKELYS:0x1,FLAG_WEIGHT_CLASSES:0x2,FLAG_CLEAN_CONDITIONALLY:0x4,ELEMENT_NODE:1,TEXT_NODE:3,DEFAULT_MAX_ELEMS_TO_PARSE:0,DEFAULT_N_TOP_CANDIDATES:5,DEFAULT_TAGS_TO_SCORE:"section,h2,h3,h4,h5,h6,p,td,pre".toUpperCase().split(","),DEFAULT_CHAR_THRESHOLD:500,REGEXPS:{unlikelyCandidates:/-ad-|ai2html|banner|breadcrumbs|combx|comment|community|cover-wrap|disqus|extra|footer|gdpr|header|legends|menu|related|remark|replies|rss|shoutbox|sidebar|skyscraper|social|sponsor|supplemental|ad-break|agegate|pagination|pager|popup|yom-remote/i,okMaybeItsACandidate:/and|article|body|column|content|main|shadow/i,positive:/article|body|content|entry|hentry|h-entry|main|page|pagination|post|text|blog|story/i,negative:/hidden|^hid$| hid$| hid |^hid |banner|combx|comment|com-|contact|foot|footer|footnote|gdpr|masthead|media|meta|outbrain|promo|related|scroll|share|shoutbox|sidebar|skyscraper|sponsor|shopping|tags|tool|widget/i,extraneous:/print|archive|comment|discuss|e[\-]?mail|share|reply|all|login|sign|single|utility/i,byline:/byline|author|dateline|writtenby|p-author/i,replaceFonts:/<(\/?)font[^>]*>/gi,normalize:/\s{2,}/g,videos:/\/\/(www\.)?((dailymotion|youtube|youtube-nocookie|player\.vimeo|v\.qq)\.com|(archive|upload\.wikimedia)\.org|player\.twitch\.tv)/i,shareElements:/(\b|_)(share|sharedaddy)(\b|_)/i,nextLink:/(next|weiter|continue|>([^\|]|$)|Â»([^\|]|$))/i,prevLink:/(prev|earl|old|new|<|Â«)/i,whitespace:/^\s*$/,hasContent:/\S$/},DIV_TO_P_ELEMS:["A","BLOCKQUOTE","DL","DIV","IMG","OL","P","PRE","TABLE","UL","SELECT"],ALTER_TO_DIV_EXCEPTIONS:["DIV","ARTICLE","SECTION","P"],PRESENTATIONAL_ATTRIBUTES:["align","background","bgcolor","border","cellpadding","cellspacing","frame","hspace","rules","style","valign","vspace"],DEPRECATED_SIZE_ATTRIBUTE_ELEMS:["TABLE","TH","TD","HR","PRE"],PHRASING_ELEMS:["ABBR","AUDIO","B","BDO","BR","BUTTON","CITE","CODE","DATA","DATALIST","DFN","EM","EMBED","I","IMG","INPUT","KBD","LABEL","MARK","MATH","METER","NOSCRIPT","OBJECT","OUTPUT","PROGRESS","Q","RUBY","SAMP","SCRIPT","SELECT","SMALL","SPAN","STRONG","SUB","SUP","TEXTAREA","TIME","VAR","WBR"],CLASSES_TO_PRESERVE:["page"],_postProcessContent:function(articleContent){this._fixRelativeUris(articleContent);if(!this._keepClasses){this._cleanClasses(articleContent)}},_removeNodes:function(nodeList,filterFn){if(this._docJSDOMParser&&nodeList._isLiveNodeList){throw new Error("Do not pass live node lists to _removeNodes")}for(var i=nodeList.length-1;i>=0;i-=1){var node=nodeList[i];var parentNode=node.parentNode;if(parentNode){if(!filterFn||filterFn.call(this,node,i,nodeList)){parentNode.removeChild(node)}}}},_replaceNodeTags:function(nodeList,newTagName){if(this._docJSDOMParser&&nodeList._isLiveNodeList){throw new Error("Do not pass live node lists to _replaceNodeTags")}for(var i=nodeList.length-1;i>=0;i-=1){var node=nodeList[i];this._setNodeTag(node,newTagName)}},_forEachNode:function(nodeList,fn){Array.prototype.forEach.call(nodeList,fn,this)},_someNode:function(nodeList,fn){return Array.prototype.some.call(nodeList,fn,this)},_everyNode:function(nodeList,fn){return Array.prototype.every.call(nodeList,fn,this)},_concatNodeLists:function(){var slice=Array.prototype.slice;var args=slice.call(arguments);var nodeLists=args.map(function(list){return slice.call(list)});return Array.prototype.concat.apply([],nodeLists)},_getAllNodesWithTag:function(node,tagNames){if(node.querySelectorAll){return node.querySelectorAll(tagNames.join(","))}return[].concat.apply([],tagNames.map(function(tag){var collection=node.getElementsByTagName(tag);return Array.isArray(collection)?collection:Array.from(collection)}))},_cleanClasses:function(node){var classesToPreserve=this._classesToPreserve;var className=(node.getAttribute("class")||"").split(/\s+/).filter(function(cls){return classesToPreserve.indexOf(cls)!=-1}).join(" ");if(className){node.setAttribute("class",className)}else{node.removeAttribute("class")}for(node=node.firstElementChild;node;node=node.nextElementSibling){this._cleanClasses(node)}},_fixRelativeUris:function(articleContent){var baseURI=this._doc.baseURI;var documentURI=this._doc.documentURI;function toAbsoluteURI(uri){if(baseURI==documentURI&&uri.charAt(0)=="#"){return uri}try{return new URL(uri,baseURI).href}catch(ex){}return uri}var links=this._getAllNodesWithTag(articleContent,["a"]);this._forEachNode(links,function(link){var href=link.getAttribute("href");if(href){if(href.indexOf("javascript:")===0){if(link.childNodes.length===1&&link.childNodes[0].nodeType===this.TEXT_NODE){var text=this._doc.createTextNode(link.textContent);link.parentNode.replaceChild(text,link)}else{var container=this._doc.createElement("span");while(link.childNodes.length>0){container.appendChild(link.childNodes[0])}link.parentNode.replaceChild(container,link)}}else{link.setAttribute("href",toAbsoluteURI(href))}}});var imgs=this._getAllNodesWithTag(articleContent,["img"]);this._forEachNode(imgs,function(img){var src=img.getAttribute("src");if(src){img.setAttribute("src",toAbsoluteURI(src))}})},_getArticleTitle:function(){var doc=this._doc;var curTitle="";var origTitle="";try{curTitle=origTitle=doc.title.trim();if(typeof curTitle!=="string"){curTitle=origTitle=this._getInnerText(doc.getElementsByTagName("title")[0])}}catch(e){}var titleHadHierarchicalSeparators=false;function wordCount(str){return str.split(/\s+/).length}if((/ [\|\-\\\/>Â»] /).test(curTitle)){titleHadHierarchicalSeparators=/ [\\\/>Â»] /.test(curTitle);curTitle=origTitle.replace(/(.*)[\|\-\\\/>Â»] .*/gi,"$1");if(wordCount(curTitle)<3){curTitle=origTitle.replace(/[^\|\-\\\/>Â»]*[\|\-\\\/>Â»](.*)/gi,"$1")}}else if(curTitle.indexOf(": ")!==-1){var headings=this._concatNodeLists(doc.getElementsByTagName("h1"),doc.getElementsByTagName("h2"));var trimmedTitle=curTitle.trim();var match=this._someNode(headings,function(heading){return heading.textContent.trim()===trimmedTitle});if(!match){curTitle=origTitle.substring(origTitle.lastIndexOf(":")+1);if(wordCount(curTitle)<3){curTitle=origTitle.substring(origTitle.indexOf(":")+1);}else if(wordCount(origTitle.substr(0,origTitle.indexOf(":")))>5){curTitle=origTitle}}}else if(curTitle.length>150||curTitle.length<15){var hOnes=doc.getElementsByTagName("h1");if(hOnes.length===1){curTitle=this._getInnerText(hOnes[0])}}curTitle=curTitle.trim().replace(this.REGEXPS.normalize," ");var curTitleWordCount=wordCount(curTitle);if(curTitleWordCount<=4&&(!titleHadHierarchicalSeparators||curTitleWordCount!=wordCount(origTitle.replace(/[\|\-\\\/>Â»]+/g,""))-1)){curTitle=origTitle}return curTitle},_prepDocument:function(){var doc=this._doc;this._removeNodes(this._getAllNodesWithTag(doc,["style"]));if(doc.body){this._replaceBrs(doc.body)}this._replaceNodeTags(this._getAllNodesWithTag(doc,["font"]),"SPAN")},_nextElement:function(node){var next=node;while(next&&(next.nodeType!=this.ELEMENT_NODE)&&this.REGEXPS.whitespace.test(next.textContent)){next=next.nextSibling}return next},_replaceBrs:function(elem){this._forEachNode(this._getAllNodesWithTag(elem,["br"]),function(br){var next=br.nextSibling;var replaced=false;while((next=this._nextElement(next))&&(next.tagName=="BR")){replaced=true;var brSibling=next.nextSibling;next.parentNode.removeChild(next);next=brSibling}if(replaced){var p=this._doc.createElement("p");br.parentNode.replaceChild(p,br);next=p.nextSibling;while(next){if(next.tagName=="BR"){var nextElem=this._nextElement(next.nextSibling);if(nextElem&&nextElem.tagName=="BR"){break}}if(!this._isPhrasingContent(next)){break}var sibling=next.nextSibling;p.appendChild(next);next=sibling}while(p.lastChild&&this._isWhitespace(p.lastChild)){p.removeChild(p.lastChild)}if(p.parentNode.tagName==="P"){this._setNodeTag(p.parentNode,"DIV")}}})},_setNodeTag:function(node,tag){this.log("_setNodeTag",node,tag);if(this._docJSDOMParser){node.localName=tag.toLowerCase();node.tagName=tag.toUpperCase();return node}var replacement=node.ownerDocument.createElement(tag);while(node.firstChild){replacement.appendChild(node.firstChild)}node.parentNode.replaceChild(replacement,node);if(node.readability){replacement.readability=node.readability}for(var i=0;i<node.attributes.length;i+=1){try{replacement.setAttribute(node.attributes[i].name,node.attributes[i].value)}catch(ex){}}return replacement},_prepArticle:function(articleContent){this._cleanStyles(articleContent);this._markDataTables(articleContent);this._fixLazyImages(articleContent);this._cleanConditionally(articleContent,"form");this._cleanConditionally(articleContent,"fieldset");this._clean(articleContent,"object");this._clean(articleContent,"embed");this._clean(articleContent,"h1");this._clean(articleContent,"footer");this._clean(articleContent,"link");this._clean(articleContent,"aside");var shareElementThreshold=this.DEFAULT_CHAR_THRESHOLD;this._forEachNode(articleContent.children,function(topCandidate){this._cleanMatchedNodes(topCandidate,function(node,matchString){return this.REGEXPS.shareElements.test(matchString)&&node.textContent.length<shareElementThreshold})});var h2=articleContent.getElementsByTagName("h2");if(h2.length===1){var lengthSimilarRate=(h2[0].textContent.length-this._articleTitle.length)/this._articleTitle.length;if(Math.abs(lengthSimilarRate)<0.5){var titlesMatch=false;if(lengthSimilarRate>0){titlesMatch=h2[0].textContent.includes(this._articleTitle)}else{titlesMatch=this._articleTitle.includes(h2[0].textContent)}if(titlesMatch){this._clean(articleContent,"h2")}}}this._clean(articleContent,"iframe");this._clean(articleContent,"input");this._clean(articleContent,"textarea");this._clean(articleContent,"select");this._clean(articleContent,"button");this._cleanHeaders(articleContent);this._cleanConditionally(articleContent,"table");this._cleanConditionally(articleContent,"ul");this._cleanConditionally(articleContent,"div");this._removeNodes(this._getAllNodesWithTag(articleContent,["p"]),function(paragraph){var imgCount=paragraph.getElementsByTagName("img").length;var embedCount=paragraph.getElementsByTagName("embed").length;var objectCount=paragraph.getElementsByTagName("object").length;var iframeCount=paragraph.getElementsByTagName("iframe").length;var totalCount=imgCount+embedCount+objectCount+iframeCount;return totalCount===0&&!this._getInnerText(paragraph,false)});this._forEachNode(this._getAllNodesWithTag(articleContent,["br"]),function(br){var next=this._nextElement(br.nextSibling);if(next&&next.tagName=="P"){br.parentNode.removeChild(br)}});this._forEachNode(this._getAllNodesWithTag(articleContent,["table"]),function(table){var tbody=this._hasSingleTagInsideElement(table,"TBODY")?table.firstElementChild:table;if(this._hasSingleTagInsideElement(tbody,"TR")){var row=tbody.firstElementChild;if(this._hasSingleTagInsideElement(row,"TD")){var cell=row.firstElementChild;cell=this._setNodeTag(cell,this._everyNode(cell.childNodes,this._isPhrasingContent)?"P":"DIV");table.parentNode.replaceChild(cell,table)}}})},_initializeNode:function(node){node.readability={"contentScore":0};switch(node.tagName){case "DIV":node.readability.contentScore+=5;break;case "PRE":case "TD":case "BLOCKQUOTE":node.readability.contentScore+=3;break;case "ADDRESS":case "OL":case "UL":case "DL":case "DD":case "DT":case "LI":case "FORM":node.readability.contentScore-=3;break;case "H1":case "H2":case "H3":case "H4":case "H5":case "H6":case "TH":node.readability.contentScore-=5;break}node.readability.contentScore+=this._getClassWeight(node)},_removeAndGetNext:function(node){var nextNode=this._getNextNode(node,true);node.parentNode.removeChild(node);return nextNode},_getNextNode:function(node,ignoreSelfAndKids){if(!ignoreSelfAndKids&&node.firstElementChild){return node.firstElementChild}if(node.nextElementSibling){return node.nextElementSibling}do{node=node.parentNode}while(node&&!node.nextElementSibling);return node&&node.nextElementSibling},_checkByline:function(node,matchString){if(this._articleByline){return false}if(node.getAttribute!==undefined){var rel=node.getAttribute("rel");var itemprop=node.getAttribute("itemprop")}if((rel==="author"||(itemprop&&itemprop.indexOf("author")!==-1)||this.REGEXPS.byline.test(matchString))&&this._isValidByline(node.textContent)){this._articleByline=node.textContent.trim();return true}return false},_getNodeAncestors:function(node,maxDepth){maxDepth=maxDepth||0;var i=0,ancestors=[];while(node.parentNode){ancestors.push(node.parentNode);if(maxDepth&& ++i===maxDepth){break}node=node.parentNode}return ancestors},_grabArticle:function(page){this.log("**** grabArticle ****");var doc=this._doc;var isPaging=(page!==null?true:false);page=page?page:this._doc.body;if(!page){this.log("No body found in document. Abort.");return null}var pageCacheHtml=page.innerHTML;while(true){var stripUnlikelyCandidates=this._flagIsActive(this.FLAG_STRIP_UNLIKELYS);var elementsToScore=[];var node=this._doc.documentElement;while(node){var matchString=node.className+" "+node.id;if(!this._isProbablyVisible(node)){this.log("Removing hidden node - "+matchString);node=this._removeAndGetNext(node);continue}if(this._checkByline(node,matchString)){node=this._removeAndGetNext(node);continue}if(stripUnlikelyCandidates){if(this.REGEXPS.unlikelyCandidates.test(matchString)&&!this.REGEXPS.okMaybeItsACandidate.test(matchString)&&!this._hasAncestorTag(node,"table")&&node.tagName!=="BODY"&&node.tagName!=="A"){this.log("Removing unlikely candidate - "+matchString);node=this._removeAndGetNext(node);continue}}if((node.tagName==="DIV"||node.tagName==="SECTION"||node.tagName==="HEADER"||node.tagName==="H1"||node.tagName==="H2"||node.tagName==="H3"||node.tagName==="H4"||node.tagName==="H5"||node.tagName==="H6")&&this._isElementWithoutContent(node)){node=this._removeAndGetNext(node);continue}if(this.DEFAULT_TAGS_TO_SCORE.indexOf(node.tagName)!==-1){elementsToScore.push(node)}if(node.tagName==="DIV"){var p=null;var childNode=node.firstChild;while(childNode){var nextSibling=childNode.nextSibling;if(this._isPhrasingContent(childNode)){if(p!==null){p.appendChild(childNode)}else if(!this._isWhitespace(childNode)){p=doc.createElement("p");node.replaceChild(p,childNode);p.appendChild(childNode)}}else if(p!==null){while(p.lastChild&&this._isWhitespace(p.lastChild)){p.removeChild(p.lastChild)}p=null}childNode=nextSibling}if(this._hasSingleTagInsideElement(node,"P")&&this._getLinkDensity(node)<0.25){var newNode=node.children[0];node.parentNode.replaceChild(newNode,node);node=newNode;elementsToScore.push(node)}else if(!this._hasChildBlockElement(node)){node=this._setNodeTag(node,"P");elementsToScore.push(node)}}node=this._getNextNode(node)}var candidates=[];this._forEachNode(elementsToScore,function(elementToScore){if(!elementToScore.parentNode||typeof(elementToScore.parentNode.tagName)==="undefined"){return}var innerText=this._getInnerText(elementToScore);if(innerText.length<25){return}var ancestors=this._getNodeAncestors(elementToScore,3);if(ancestors.length===0){return}var contentScore=0;contentScore+=1;contentScore+=innerText.split(",").length;contentScore+=Math.min(Math.floor(innerText.length/100),3);this._forEachNode(ancestors,function(ancestor,level){if(!ancestor.tagName||!ancestor.parentNode||typeof(ancestor.parentNode.tagName)==="undefined"){return}if(typeof(ancestor.readability)==="undefined"){this._initializeNode(ancestor);candidates.push(ancestor)}if(level===0){var scoreDivider=1}else if(level===1){scoreDivider=2}else{scoreDivider=level*3}ancestor.readability.contentScore+=contentScore/scoreDivider})});var topCandidates=[];for(var c=0,cl=candidates.length;c<cl;c+=1){var candidate=candidates[c];var candidateScore=candidate.readability.contentScore*(1-this._getLinkDensity(candidate));candidate.readability.contentScore=candidateScore;this.log("Candidate:",candidate,"with score "+candidateScore);for(var t=0;t<this._nbTopCandidates;t+=1){var aTopCandidate=topCandidates[t];if(!aTopCandidate||candidateScore>aTopCandidate.readability.contentScore){topCandidates.splice(t,0,candidate);if(topCandidates.length>this._nbTopCandidates){topCandidates.pop()}break}}}var topCandidate=topCandidates[0]||null;var neededToCreateTopCandidate=false;var parentOfTopCandidate;if(topCandidate===null||topCandidate.tagName==="BODY"){topCandidate=doc.createElement("DIV");neededToCreateTopCandidate=true;var kids=page.childNodes;while(kids.length){this.log("Moving child out:",kids[0]);topCandidate.appendChild(kids[0])}page.appendChild(topCandidate);this._initializeNode(topCandidate)}else if(topCandidate){var alternativeCandidateAncestors=[];for(var i=1;i<topCandidates.length;i+=1){if(topCandidates[i].readability.contentScore/topCandidate.readability.contentScore>=0.75){alternativeCandidateAncestors.push(this._getNodeAncestors(topCandidates[i]))}}var MINIMUM_TOPCANDIDATES=3;if(alternativeCandidateAncestors.length>=MINIMUM_TOPCANDIDATES){parentOfTopCandidate=topCandidate.parentNode;while(parentOfTopCandidate.tagName!=="BODY"){var listsContainingThisAncestor=0;for(var ancestorIndex=0;ancestorIndex<alternativeCandidateAncestors.length&&listsContainingThisAncestor<MINIMUM_TOPCANDIDATES;ancestorIndex+=1){listsContainingThisAncestor+=Number(alternativeCandidateAncestors[ancestorIndex].includes(parentOfTopCandidate))}if(listsContainingThisAncestor>=MINIMUM_TOPCANDIDATES){topCandidate=parentOfTopCandidate;break}parentOfTopCandidate=parentOfTopCandidate.parentNode}}if(!topCandidate.readability){this._initializeNode(topCandidate)}parentOfTopCandidate=topCandidate.parentNode;var lastScore=topCandidate.readability.contentScore;var scoreThreshold=lastScore/3;while(parentOfTopCandidate.tagName!=="BODY"){if(!parentOfTopCandidate.readability){parentOfTopCandidate=parentOfTopCandidate.parentNode;continue}var parentScore=parentOfTopCandidate.readability.contentScore;if(parentScore<scoreThreshold){break}if(parentScore>lastScore){topCandidate=parentOfTopCandidate;break}lastScore=parentOfTopCandidate.readability.contentScore;parentOfTopCandidate=parentOfTopCandidate.parentNode}parentOfTopCandidate=topCandidate.parentNode;while(parentOfTopCandidate.tagName!="BODY"&&parentOfTopCandidate.children.length==1){topCandidate=parentOfTopCandidate;parentOfTopCandidate=topCandidate.parentNode}if(!topCandidate.readability){this._initializeNode(topCandidate)}}var articleContent=doc.createElement("DIV");if(isPaging){articleContent.id="readability-content"}var siblingScoreThreshold=Math.max(10,topCandidate.readability.contentScore*0.2);parentOfTopCandidate=topCandidate.parentNode;var siblings=parentOfTopCandidate.children;for(var s=0,sl=siblings.length;s<sl;s+=1){var sibling=siblings[s];var append=false;this.log("Looking at sibling node:",sibling,sibling.readability?("with score "+sibling.readability.contentScore):"");this.log("Sibling has score",sibling.readability?sibling.readability.contentScore:"Unknown");if(sibling===topCandidate){append=true}else{var contentBonus=0;if(sibling.className===topCandidate.className&&topCandidate.className!==""){contentBonus+=topCandidate.readability.contentScore*0.2}if(sibling.readability&&((sibling.readability.contentScore+contentBonus)>=siblingScoreThreshold)){append=true}else if(sibling.nodeName==="P"){var linkDensity=this._getLinkDensity(sibling);var nodeContent=this._getInnerText(sibling);var nodeLength=nodeContent.length;if(nodeLength>80&&linkDensity<0.25){append=true}else if(nodeLength<80&&nodeLength>0&&linkDensity===0&&nodeContent.search(/\.( |$)/)!==-1){append=true}}}if(append){this.log("Appending node:",sibling);if(this.ALTER_TO_DIV_EXCEPTIONS.indexOf(sibling.nodeName)===-1){this.log("Altering sibling:",sibling,"to div.");sibling=this._setNodeTag(sibling,"DIV")}articleContent.appendChild(sibling);s-=1;sl-=1}}if(this._debug){this.log("Article content pre-prep: "+articleContent.innerHTML)}this._prepArticle(articleContent);if(this._debug){this.log("Article content post-prep: "+articleContent.innerHTML)}if(neededToCreateTopCandidate){topCandidate.id="readability-page-1";topCandidate.className="page"}else{var div=doc.createElement("DIV");div.id="readability-page-1";div.className="page";var children=articleContent.childNodes;while(children.length){div.appendChild(children[0])}articleContent.appendChild(div)}if(this._debug){this.log("Article content after paging: "+articleContent.innerHTML)}var parseSuccessful=true;var textLength=this._getInnerText(articleContent,true).length;if(textLength<this._charThreshold){parseSuccessful=false;page.innerHTML=pageCacheHtml;if(this._flagIsActive(this.FLAG_STRIP_UNLIKELYS)){this._removeFlag(this.FLAG_STRIP_UNLIKELYS);this._attempts.push({articleContent:articleContent,textLength:textLength})}else if(this._flagIsActive(this.FLAG_WEIGHT_CLASSES)){this._removeFlag(this.FLAG_WEIGHT_CLASSES);this._attempts.push({articleContent:articleContent,textLength:textLength})}else if(this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)){this._removeFlag(this.FLAG_CLEAN_CONDITIONALLY);this._attempts.push({articleContent:articleContent,textLength:textLength})}else{this._attempts.push({articleContent:articleContent,textLength:textLength});this._attempts.sort(function(a,b){return b.textLength-a.textLength});if(!this._attempts[0].textLength){return null}articleContent=this._attempts[0].articleContent;parseSuccessful=true}}if(parseSuccessful){var ancestors=[parentOfTopCandidate,topCandidate].concat(this._getNodeAncestors(parentOfTopCandidate));this._someNode(ancestors,function(ancestor){if(!ancestor.tagName){return false}var articleDir=ancestor.getAttribute("dir");if(articleDir){this._articleDir=articleDir;return true}return false});return articleContent}}},_isValidByline:function(byline){if(typeof byline=="string"||byline instanceof String){byline=byline.trim();return(byline.length>0)&&(byline.length<100)}return false},_getArticleMetadata:function(){var metadata={};var values={};var metaElements=this._doc.getElementsByTagName("meta");var propertyPattern=/\s*(dc|dcterm|og|twitter)\s*:\s*(author|creator|description|title|site_name)\s*/gi;var namePattern=/^\s*(?:(dc|dcterm|og|twitter|weibo:(article|webpage))\s*[\.:]\s*)?(author|creator|description|title|site_name)\s*$/i;this._forEachNode(metaElements,function(element){var elementName=element.getAttribute("name");var elementProperty=element.getAttribute("property");var content=element.getAttribute("content");if(!content){return}var matches=null;var name=null;if(elementProperty){matches=elementProperty.match(propertyPattern);if(matches){for(var i=matches.length-1;i>=0;i-=1){name=matches[i].toLowerCase().replace(/\s/g,"");values[name]=content.trim()}}}if(!matches&&elementName&&namePattern.test(elementName)){name=elementName;if(content){name=name.toLowerCase().replace(/\s/g,"").replace(/\./g,":");values[name]=content.trim()}}});metadata.title=values["dc:title"]||values["dcterm:title"]||values["og:title"]||values["weibo:article:title"]||values["weibo:webpage:title"]||values["title"]||values["twitter:title"];if(!metadata.title){metadata.title=this._getArticleTitle()}metadata.byline=values["dc:creator"]||values["dcterm:creator"]||values["author"];metadata.excerpt=values["dc:description"]||values["dcterm:description"]||values["og:description"]||values["weibo:article:description"]||values["weibo:webpage:description"]||values["description"]||values["twitter:description"];metadata.siteName=values["og:site_name"];return metadata},_removeScripts:function(doc){this._removeNodes(this._getAllNodesWithTag(doc,["script"]),function(scriptNode){scriptNode.nodeValue="";scriptNode.removeAttribute("src");return true});this._removeNodes(this._getAllNodesWithTag(doc,["noscript"]))},_hasSingleTagInsideElement:function(element,tag){if(element.children.length!=1||element.children[0].tagName!==tag){return false}return!this._someNode(element.childNodes,function(node){return node.nodeType===this.TEXT_NODE&&this.REGEXPS.hasContent.test(node.textContent)})},_isElementWithoutContent:function(node){return node.nodeType===this.ELEMENT_NODE&&node.textContent.trim().length==0&&(node.children.length==0||node.children.length==node.getElementsByTagName("br").length+node.getElementsByTagName("hr").length)},_hasChildBlockElement:function(element){return this._someNode(element.childNodes,function(node){return this.DIV_TO_P_ELEMS.indexOf(node.tagName)!==-1||this._hasChildBlockElement(node)})},_isPhrasingContent:function(node){return node.nodeType===this.TEXT_NODE||this.PHRASING_ELEMS.indexOf(node.tagName)!==-1||((node.tagName==="A"||node.tagName==="DEL"||node.tagName==="INS")&&this._everyNode(node.childNodes,this._isPhrasingContent))},_isWhitespace:function(node){return(node.nodeType===this.TEXT_NODE&&node.textContent.trim().length===0)||(node.nodeType===this.ELEMENT_NODE&&node.tagName==="BR")},_getInnerText:function(e,normalizeSpaces){normalizeSpaces=(typeof normalizeSpaces==="undefined")?true:normalizeSpaces;var textContent=e.textContent.trim();if(normalizeSpaces){return textContent.replace(this.REGEXPS.normalize," ")}return textContent},_getCharCount:function(e,s){s=s||",";return this._getInnerText(e).split(s).length-1},_cleanStyles:function(e){if(!e||e.tagName.toLowerCase()==="svg"){return}for(var i=0;i<this.PRESENTATIONAL_ATTRIBUTES.length;i+=1){e.removeAttribute(this.PRESENTATIONAL_ATTRIBUTES[i])}if(this.DEPRECATED_SIZE_ATTRIBUTE_ELEMS.indexOf(e.tagName)!==-1){e.removeAttribute("width");e.removeAttribute("height")}var cur=e.firstElementChild;while(cur!==null){this._cleanStyles(cur);cur=cur.nextElementSibling}},_getLinkDensity:function(element){var textLength=this._getInnerText(element).length;if(textLength===0){return 0}var linkLength=0;this._forEachNode(element.getElementsByTagName("a"),function(linkNode){linkLength+=this._getInnerText(linkNode).length});return linkLength/textLength},_getClassWeight:function(e){if(!this._flagIsActive(this.FLAG_WEIGHT_CLASSES)){return 0}var weight=0;if(typeof(e.className)==="string"&&e.className!==""){if(this.REGEXPS.negative.test(e.className)){weight-=25}if(this.REGEXPS.positive.test(e.className)){weight+=25}}if(typeof(e.id)==="string"&&e.id!==""){if(this.REGEXPS.negative.test(e.id)){weight-=25}if(this.REGEXPS.positive.test(e.id)){weight+=25}}return weight},_clean:function(e,tag){var isEmbed=["object","embed","iframe"].indexOf(tag)!==-1;this._removeNodes(this._getAllNodesWithTag(e,[tag]),function(element){if(isEmbed){for(var i=0;i<element.attributes.length;i+=1){if(this.REGEXPS.videos.test(element.attributes[i].value)){return false}}if(element.tagName==="object"&&this.REGEXPS.videos.test(element.innerHTML)){return false}}return true})},_hasAncestorTag:function(node,tagName,maxDepth,filterFn){maxDepth=maxDepth||3;tagName=tagName.toUpperCase();var depth=0;while(node.parentNode){if(maxDepth>0&&depth>maxDepth){return false}if(node.parentNode.tagName===tagName&&(!filterFn||filterFn(node.parentNode))){return true}node=node.parentNode;depth+=1}return false},_getRowAndColumnCount:function(table){var rows=0;var columns=0;var trs=table.getElementsByTagName("tr");for(var i=0;i<trs.length;i+=1){var rowspan=trs[i].getAttribute("rowspan")||0;if(rowspan){rowspan=parseInt(rowspan,10)}rows+=(rowspan||1);var columnsInThisRow=0;var cells=trs[i].getElementsByTagName("td");for(var j=0;j<cells.length;j+=1){var colspan=cells[j].getAttribute("colspan")||0;if(colspan){colspan=parseInt(colspan,10)}columnsInThisRow+=(colspan||1)}columns=Math.max(columns,columnsInThisRow)}return{rows:rows,columns:columns}},_markDataTables:function(root){var tables=root.getElementsByTagName("table");for(var i=0;i<tables.length;i+=1){var table=tables[i];var role=table.getAttribute("role");if(role=="presentation"){table._readabilityDataTable=false;continue}var datatable=table.getAttribute("datatable");if(datatable=="0"){table._readabilityDataTable=false;continue}var summary=table.getAttribute("summary");if(summary){table._readabilityDataTable=true;continue}var caption=table.getElementsByTagName("caption")[0];if(caption&&caption.childNodes.length>0){table._readabilityDataTable=true;continue}var dataTableDescendants=["col","colgroup","tfoot","thead","th"];var descendantExists=function(tag){return!!table.getElementsByTagName(tag)[0]};if(dataTableDescendants.some(descendantExists)){this.log("Data table because found data-y descendant");table._readabilityDataTable=true;continue}if(table.getElementsByTagName("table")[0]){table._readabilityDataTable=false;continue}var sizeInfo=this._getRowAndColumnCount(table);if(sizeInfo.rows>=10||sizeInfo.columns>4){table._readabilityDataTable=true;continue}table._readabilityDataTable=sizeInfo.rows*sizeInfo.columns>10}},_fixLazyImages:function(root){this._forEachNode(this._getAllNodesWithTag(root,["img","picture","figure"]),function(elem){if((!elem.src&&(!elem.srcset||elem.srcset=="null"))||elem.className.toLowerCase().indexOf("lazy")!==-1){for(var i=0;i<elem.attributes.length;i+=1){var attr=elem.attributes[i];if(attr.name==="src"||attr.name==="srcset"){continue}var copyTo=null;if(/\.(jpg|jpeg|png|webp)\s+\d/.test(attr.value)){copyTo="srcset"}else if(/^\s*\S+\.(jpg|jpeg|png|webp)\S*\s*$/.test(attr.value)){copyTo="src"}if(copyTo){if(elem.tagName==="IMG"||elem.tagName==="PICTURE"){elem.setAttribute(copyTo,attr.value)}else if(elem.tagName==="FIGURE"&&!this._getAllNodesWithTag(elem,["img","picture"]).length){var img=this._doc.createElement("img");img.setAttribute(copyTo,attr.value);elem.appendChild(img)}}}}})},_cleanConditionally:function(e,tag){if(!this._flagIsActive(this.FLAG_CLEAN_CONDITIONALLY)){return}var isList=tag==="ul"||tag==="ol";this._removeNodes(this._getAllNodesWithTag(e,[tag]),function(node){var isDataTable=function(t){return t._readabilityDataTable};if(tag==="table"&&isDataTable(node)){return false}if(this._hasAncestorTag(node,"table",-1,isDataTable)){return false}var weight=this._getClassWeight(node);var contentScore=0;this.log("Cleaning Conditionally",node);if(weight+contentScore<0){return true}if(this._getCharCount(node,",")<10){var p=node.getElementsByTagName("p").length;var img=node.getElementsByTagName("img").length;var li=node.getElementsByTagName("li").length-100;var input=node.getElementsByTagName("input").length;var embedCount=0;var embeds=this._getAllNodesWithTag(node,["object","embed","iframe"]);for(var i=0;i<embeds.length;i+=1){for(var j=0;j<embeds[i].attributes.length;j+=1){if(this.REGEXPS.videos.test(embeds[i].attributes[j].value)){return false}}if(embeds[i].tagName==="object"&&this.REGEXPS.videos.test(embeds[i].innerHTML)){return false}embedCount+=1}var linkDensity=this._getLinkDensity(node);var contentLength=this._getInnerText(node).length;var haveToRemove=(img>1&&p/img<0.5&&!this._hasAncestorTag(node,"figure"))||(!isList&&li>p)||(input>Math.floor(p/3))||(!isList&&contentLength<25&&(img===0||img>2)&&!this._hasAncestorTag(node,"figure"))||(!isList&&weight<25&&linkDensity>0.2)||(weight>=25&&linkDensity>0.5)||((embedCount===1&&contentLength<75)||embedCount>1);return haveToRemove}return false})},_cleanMatchedNodes:function(e,filter){var endOfSearchMarkerNode=this._getNextNode(e,true);var next=this._getNextNode(e);while(next&&next!=endOfSearchMarkerNode){if(filter.call(this,next,next.className+" "+next.id)){next=this._removeAndGetNext(next)}else{next=this._getNextNode(next)}}},_cleanHeaders:function(e){this._removeNodes(this._getAllNodesWithTag(e,["h1","h2"]),function(header){return this._getClassWeight(header)<0})},_flagIsActive:function(flag){return(this._flags&flag)>0},_removeFlag:function(flag){this._flags=this._flags& ~flag},_isProbablyVisible:function(node){return(!node.style||node.style.display!="none")&&!node.hasAttribute("hidden")&&(!node.hasAttribute("aria-hidden")||node.getAttribute("aria-hidden")!="true"||(node.className&&node.className.indexOf&&node.className.indexOf("fallback-image")!==-1))},parse:function(){if(this._maxElemsToParse>0){var numTags=this._doc.getElementsByTagName("*").length;if(numTags>this._maxElemsToParse){throw new Error("Aborting parsing document; "+numTags+" elements found")}}this._removeScripts(this._doc);this._prepDocument();var metadata=this._getArticleMetadata();this._articleTitle=metadata.title;var articleContent=this._grabArticle();if(!articleContent){return null}this.log("Grabbed: "+articleContent.innerHTML);this._postProcessContent(articleContent);if(!metadata.excerpt){var paragraphs=articleContent.getElementsByTagName("p");if(paragraphs.length>0){metadata.excerpt=paragraphs[0].textContent.trim()}}var textContent=articleContent.textContent;return{title:this._articleTitle,byline:metadata.byline||this._articleByline,dir:this._articleDir,content:articleContent.innerHTML,textContent:textContent,length:textContent.length,excerpt:metadata.excerpt,siteName:metadata.siteName||this._articleSiteName}}};if(typeof module==="object"){module.exports=Readability}

        [...document.querySelectorAll('details')].forEach(details => details.setAttribute('open', ''));

        [...document.querySelectorAll('*')].forEach(node => {
          const pos = window.getComputedStyle(node).getPropertyValue("position");
          if (pos == "fixed" || pos == "sticky") {
            node.style.position = "unset";
          }
        });

        if (isProbablyReaderable(document.cloneNode(true))) {
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

    await sendToRemarkable(title, myPDF);

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

async function sendToRemarkable(title, myPDF) {
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
      fileType: 'pdf',
      lastOpenedPage: 0,
      lineHeight: -1,
      margins: 180,
      pageCount: 0,
      textScale: 1,
      transform: {},
    }));
    zip.file(`${ID}.pagedata`, []);
    zip.file(`${ID}.pdf`, myPDF);
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
