/*global process, module, setTimeout */

/* Copyright 2013 Bodil Stokke <bodil@bodil.org>
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

var child = require("child_process"),
    events = require("events"),
    async = require("async");

var repls = {
  haskell: {
    command: "ghci",
    preamble: [":set +m\n"],
    prompt: "Prelude> ",
    chopPrompt: "Prelude| ",
    appendIfMulti: "\n"
  },

  javascript: {
    command: "node",
    args: ["-i"],
    prompt: "> ",
    chopPrompt: "... ",
    nil: "undefined"
  },

  clojure: {
    command: "/opt/java/bin/java",
    args: ["-classpath",
           "jars/clojure-1.5.1.jar:jars/core.logic-0.8.4.jar",
           "clojure.main"],
    prompt: "user=> ",
    chopPrompt: "  #_=> ",
    nil: "nil"
  },

  ocaml: {
    command: "ocaml",
    prompt: "# ",
    chopPrompt: "  "
  },

  java: {
    command: "/opt/java/bin/java",
    args: ["-jar", "jars/javarepl.jar", "--colors=false"],
    prompt: "java> ",
    chopPrompt: "    | "
  },

  sml: {
    command: "/usr/lib/smlnj/bin/sml",
    prompt: "- ",
    chopPrompt: "= "
  },

  bodol: {
    command: "java",
    args: ["-jar", "jars/bodol.jar"],
    prompt: ">> ",
    replace: [["\n", " "]],
    appendAlways: "\n"
  }
};

var occur = function(c, s) {
  return s.split(c).length - 1;
};

var replaceInput = function(s, res) {
  return res.reduce(function(acc, re) {
    return acc.split(re[0]).join(re[1]);
  }, s);
};

var wrapProcess = function(proc, repl) {
  var result = new events.EventEmitter(),
      buf = "", err = "", errTimer = null;

  proc.stdout.on("data", function(chunk) {
    var out;
    if (err.length > 0) return;
    console.log("OUT:", chunk);
    buf += chunk;
    if (buf.slice(buf.length - repl.prompt.length) === repl.prompt) {
      while (repl.chopPrompt &&
             buf.slice(0, repl.chopPrompt.length) === repl.chopPrompt) {
        buf = buf.slice(repl.chopPrompt.length);
      }
      out = buf.slice(0, buf.length - repl.prompt.length);
      result.emit("result", {
        value: (out.trim() === repl.nil) ? null : out
      });
      buf = "";
    }
  });

  var errReport = function() {
    errTimer = null;
    result.emit("result", {
      error: err
    });
    err = "";
  };

  proc.stderr.on("data", function(chunk) {
    console.log("ERR:", chunk);
    err += chunk;
    if (errTimer === null) {
      errTimer = setTimeout(errReport, 100);
    }
  });

  result.close = function() {
    proc.kill();
  };

  result.sendRaw = function(data, cb) {
    proc.stdin.write(data);
    result.once("result", function(s) {
      cb(null, s);
    });
    console.log("IN:", data);
  };

  result.send = function(data, cb) {
    if (repl.replace) data = replaceInput(data, repl.replace);
    if (repl.appendIfMulti &&
        occur("\n", data) > 1) {
      data = data + repl.appendIfMulti;
    } else if (repl.appendAlways) {
      data = data + repl.appendAlways;
    }
    result.sendRaw(data, cb);
  };

  result.options = repl;

  return result;
};

var createRepl = function(e, cb) {
  var repl = repls[e.language],
      proc = child.spawn(repl.command, repl.args, {
        env: {
          TERM: "dumb",
          LANG: process.env.LANG
        }
      }),
      p;
  proc.stdin.setEncoding("utf-8");
  proc.stdout.setEncoding("utf-8");
  proc.stderr.setEncoding("utf-8");
  p = wrapProcess(proc, repl);

  // Wait for initial prompt, then send preamble, then signal readiness.
  p.once("result", function() {
    if (repl.preamble) {
      async.eachSeries(repl.preamble, function(s, cb) {
        p.sendRaw(s, cb);
      }, function(err) {
        cb(err, p);
      });
    } else {
      cb(null, p);
    }
  });
};

var mapExprs = function(repl, exprs, cb) {
  async.mapSeries(exprs, function(expr, cb) {
    repl.send(expr, cb);
  }, cb);
};

module.exports.run = function(e, cb) {
  createRepl(e, function(err, repl) {
    if (err) return cb(err);
    mapExprs(repl, e.context, function(err, contextResults) {
      if (err) return cb(err);
      mapExprs(repl, e.code, function(err, codeResults) {
        if (err) return cb(err);
        repl.close();
        cb(null, {
          context: e.context,
          contextResults: contextResults,
          code: e.code,
          codeResults: codeResults
        });
      });
    });
  });
};
