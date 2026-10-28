#!/usr/bin/env node
'use strict';
// Public normal role review; all execution, journals and gates remain in the
// existing frozen review engine. Explicit Duo never enters through this facade.
const path=require('path');
function cli(args=process.argv.slice(2),root=process.cwd()){
  try{
    if(args[0]==='bind'){
      if(!args[1])throw Error('Usage: specflow review bind RECORD.json');
      console.log(JSON.stringify(require('./review-assignment.cjs').bind(path.resolve(root),args[1],path.resolve(__dirname,'..')),null,2));return 0;
    }
    return require('./duo-build.cjs').cli(args,root,'fresh-native');
  }catch(e){console.error(e.message);return 2;}
}
module.exports={cli};if(require.main===module)process.exitCode=cli();
