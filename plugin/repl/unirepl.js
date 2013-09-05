/*global module */

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
    chopPrompt: "... "
  }
};

var occur = function(c, s) {
  return s.split(c).length - 1;
};

var wrapProcess = function(proc, repl) {
  var result = new events.EventEmitter(),
      buf = "";

  proc.stdout.on("data", function(chunk) {
    buf += chunk;
    if (buf.slice(buf.length - repl.prompt.length) === repl.prompt) {
      while (repl.chopPrompt &&
             buf.slice(0, repl.chopPrompt.length) === repl.chopPrompt) {
        buf = buf.slice(repl.chopPrompt.length);
      }
      result.emit("result", buf.slice(0, buf.length - repl.prompt.length));
      buf = "";
    }
  });

  result.on("result", function(s) {
    console.log("REPL OUT:", s);
  });

  result.close = function() {
    proc.kill();
  };

  result.sendRaw = function(data, cb) {
    console.log("REPL IN:", data);
    proc.stdin.write(data);
    result.once("result", function(s) {
      cb(null, s);
    });
  };

  result.send = function(data, cb) {
    if (repl.appendIfMulti &&
        occur("\n", data) > 1) {
      data = data + repl.appendIfMulti;
    }
    result.sendRaw(data, cb);
  };

  return result;
};

var createRepl = function(e, cb) {
  var repl = repls[e.language],
      proc = child.spawn(repl.command, repl.args),
      p;
  proc.stdin.setEncoding("utf-8");
  proc.stdout.setEncoding("utf-8");
  proc.stderr.setEncoding("utf-8");
  p = wrapProcess(proc, repl);

  proc.stderr.on("data", function(data) {
    console.error("SUBPROC STDERR:", data);
  });

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
  console.log(e);
  createRepl(e, function(err, repl) {
    if (err) return cb(err);
    mapExprs(repl, e.context, function(err, contextResults) {
      if (err) return cb(err);
      mapExprs(repl, e.code, function(err, codeResults) {
        if (err) return cb(err);
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
