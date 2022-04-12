const os = require('os');
const fs = require('fs');
const querystring = require('querystring');
const axios   = require('axios').default;
const {JSDOM} = require('jsdom');

const COOKIE = readFile('cookie.log').trim();


function readFile(pth) {
  var txt = fs.readFileSync(pth, 'utf8');
  return txt.replace(/\r?\n/g, '\n');
}

function writeFile(pth, txt) {
  txt = txt.replace(/\r?\n/g, os.EOL);
  fs.writeFileSync(pth, txt);
}


async function getPackages(org, repo) {
  var rooturl = `https://github.com/orgs/${org}/packages?repo_name=${repo}`;
  var res = await axios(rooturl, {headers: {cookie: COOKIE}});
  var dom = new JSDOM(res.data, {url: rooturl});
  var {window} = dom, {document} = window, b = [];
  for (var a of document.querySelectorAll('li.Box-row a.Link--primary')) {
    var name = a.textContent;
    var url  = `https://github.com${a.getAttribute('href')}`;
    b.push({name, url});
  }
  return b;
}


async function deletePackage(name, url) {
  var optUrl = url + '/options';
  var res = await axios(optUrl, {headers: {cookie: COOKIE}});
  var dom = new JSDOM(res.data, {url: optUrl});
  var {window} = dom, {document} = window;
  var form  = document.querySelector('input[value="delete"]').parentElement;
  var input = form.querySelector('input[name="authenticity_token"]');
  var authenticity_token = input.getAttribute('value');
  var data  = querystring.stringify({_method: 'delete', authenticity_token, verify: name});
  await axios.post(url, data, {headers: {cookie: COOKIE, 'content-type': 'application/x-www-form-urlencoded'}});
}


async function main(a) {
  var org  = 'nodef';
  var repo = a[2];
  while (true) {
    var pkgs = await getPackages(org, repo), n = 0;
    for (var {name, url} of pkgs) {
      if (name === repo) continue;
      await deletePackage(name, url);
      console.log(`Deleted package ${name}.`); n++;
    }
    if (n === 0) break;
  }
}
main(process.argv);
