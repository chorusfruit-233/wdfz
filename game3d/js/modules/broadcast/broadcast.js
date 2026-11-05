/* @module-capsule */
(function($imports){
/* Public broadcast station and the five-stage school-dismissal route. Application owns all state. */
'use strict';
var Broadcast=(function(){
  var C=$imports.BROADCAST_CFG,B=$imports.BroadcastRules.normalize(),held=false,progress=0,origin=null,session=0,crowdPath=null,bellSound=null,bellStarted=false,bellNext=0;
