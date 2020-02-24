const csvParse = require('csv-parse');
const https = require('https');
const os = require('os');
const fs = require('fs');

const URL_DOCS = 'https://octokit.github.io/rest.js/v17';
const MAP_HTMLESC = new Map([
  ['quot', '`'],
  ['amp', '&'],
  ['gt', '>'],
  ['lt', '<'],
]);
const EOL = os.EOL;



// Gets text response (body) from URL (callback).
function getBodyCb(url, opt, fn) {
  var req = https.request(url, opt||{}, res => {
    var code = res.statusCode, body = '';
    if(code>=400) { res.resume(); return fn(new Error(`Request to ${url} returned ${code}`)); }
    if(code>=300 && code<400) return getBodyCb(res.headers.location, opt, fn);
    res.on('error', fn);
    res.on('data', b => body+=b);
    res.on('end', () => fn(null, body));
  });
  req.on('error', fn);
  req.end();
}

// Gets text response (body) from URL.
function getBody(url, opt) {
  return new Promise((fres, frej) => {
    getBodyCb(url, opt, (err, ans) => err? frej(err):fres(ans));
  });
}

// Gets text from html code.
function htmlText(x) {
  return unescape(x.replace(/<.*?>/g, '')).replace(/&(.*?);/g, (m ,p1) => {
    if(p1[0]==='#') {
      var code = p1.substring(p1[1]==='x'? 2:1);
      return String.fromCharCode(parseInt(code, p1[1]==='x'? 16:10));
    }
    return MAP_HTMLESC.get(p1)||'';
  });
}

async function getArgsCmds() {
  var html = await getBody(URL_DOCS), i = 0;
  var cmdsCsv = new Map();
  var argsCsv = new Map();
  do {
    var i = html.indexOf('<h3 id="', i+1);
    var j = html.indexOf('<h3 id="', i+1);
    var section = html.substring(i, j<0? html.length:j);
    var desc = htmlText(section.match(/<h3 .*?>(.*?)<\/h3>/)[1]);
    var more = htmlText(section.match(/<p>(.*?)<\/p>/s)[1]);
    var func = htmlText(section.match(/<pre .*?>(.*?)<\/pre>/s)[1]).replace(/octokit\.|[^\w\.].*/g, '');
    var args = Array.from(section.matchAll(/<tr><td>(.*?)<\/td><td>(.*?)<\/td>.*?<p>(.*?)<\/p>.*?<\/td><\/tr>/gs)).map(([m, p1, p2, p3]) => {
      if(!argsCsv.has(p1)) argsCsv.set(p1, {name: p1, desc: htmlText(p3).replace(/\n\s*/g, ' ')});
      return (p2==='yes'? '!':'')+p1;
    }).join(';');
    cmdsCsv.set(func, {func, args, desc, more});
  } while (j >= 0);
  return {args: argsCsv, cmds: cmdsCsv};
}

function writeCsvs(args, cmds) {
  var d = 'name,desc'+EOL;
  for(var {name, desc} of args.values())
    d += `${name},"${desc}"`+EOL;
  fs.writeFileSync('assets/parameters.csv', d);
  d = 'name,params,desc'+EOL;
  for(var {func, args, desc} of cmds.values())
    d += `${func},${args},"${desc}"`+EOL;
  fs.writeFileSync('assets/commands.csv', d);
}

function writeCorpusCb(fn) {
  var parameters = new Map(), commands = new Map(), done = 0, onEnd = () => {
    if(++done<2) return;
    var d = '';
    for(var k of ['name', 'desc']) {
      d += `const p_${k} = [`+EOL;
      for(var v of parameters.values())
        d += `"${v[k]}",`+EOL;
      d += `];`+EOL;
    }
    for(var k of ['name', 'params', 'desc']) {
      d += `const c_${k} = [`+EOL;
      for(var v of commands.values())
        d += `"${v[k]}",`+EOL;
      d += `];`+EOL;
    }
    d += `const parameters = {name: p_name, desc: p_desc}`+EOL;
    d += `const commands = {name: p_name, params: c_params, desc: p_desc}`+EOL;
    d += `exports.parameters = parameters;`+EOL;
    d += `exports.commands = commands;`+EOL;
    fs.writeFileSync('corpus.js', d);
    fn();
  };
  var stream1 = fs.createReadStream('assets/parameters.csv').pipe(csvParse({columns: true, comment: '#'}));
  stream1.on('data', (r) => {
    parameters.set(r.name, r);
  });
  stream1.on('end', onEnd);
  var stream2 = fs.createReadStream('assets/commands.csv').pipe(csvParse({columns: true, comment: '#'}));
  stream2.on('data', (r) => {
    commands.set(r.name, r);
  });
  stream2.on('end', onEnd);
}

function writeCorpus() {
  return new Promise((fres, frej) => writeCorpusCb(fres));
}

async function main(a) {
  if(a[2]==='csv') {
    var {args, cmds} = await getArgsCmds();
    writeCsvs(args, cmds);
  }
  await writeCorpus();
}
main(process.argv);
