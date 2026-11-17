const [, , command = 'this command', milestone = 'a later milestone'] = process.argv;
console.log(
  `"${command}" is not implemented yet. It arrives in ${milestone} (see docs/progress.md).`,
);
