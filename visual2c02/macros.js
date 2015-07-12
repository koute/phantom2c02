/*
 Copyright (c) 2010 Brian Silverman, Barry Silverman, Ed Spittles, Achim Breidenbach

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
*/

var memory = Array();
var cycle = 0;
var running = false;
var logThese=[];
var chipname='2C02';
var nodenamereset='res';
var presetLogLists=[
		['cycle'],
		['hpos','vpos'],
		['vramaddr_t','vramaddr_v'],
		['io_db','io_ab','io_rw','io_ce'],
		['rd','wr','ab','ale','db'],
	];
var ioCounter = 0;
var testprogramAddress = 0;
var chrAddress = 0;
var chrStatus = {rd:1,wr:1,ale:0};

function loadProgram(){
	if(userCode.length!=0){
		testprogram=userCode;
		cmd_setupTable();
	}
	if(userData.length!=0){
		for(var i=0;i<userData.length;i++){
			if(userData[i] != undefined){
				mWrite(i, userData[i]);
			}
		}
	}
}

function go(){
	if(typeof userSteps != "undefined"){
		if(--userSteps==0){
			running=false;
			userSteps=undefined;
		}
	}
	if(running) {
		step();
		stepDone();
		setTimeout(go, 0); // schedule the next poll
	}
}

function getResetState()
{
	var inputs = document.getElementsByName("reset_state");
	var state = -1;
	for (var i = 0; i < inputs.length; i++)
	{
		if (inputs[i].checked)
			state = inputs[i].value;
	}
	if (state == -1)
		return;
	if (resetStates[state] != undefined)
		return resetStates[state][1];
	return;
}

function initChip(){
	var start = now();
	var state = getResetState();
	if (state != undefined)
	{
		setState(state);
	}
	else
	{ // begin normal reset code
	for(var nn in nodes) {
		nodes[nn].state = false;
		nodes[nn].float = true;
	}

	nodes[ngnd].state = false;
	nodes[ngnd].float = false;
	nodes[npwr].state = true;
	nodes[npwr].float = false;
	for(var tn in transistors) transistors[tn].on = (transistors[tn].gate == npwr);
	setLow(nodenamereset);
	setLow('clk0');
	setHigh('io_ce');
	setHigh('int');
	recalcNodeList(allNodes());
	for(var i=0;i<4;i++){setHigh('clk0'), setLow('clk0');}
	setHigh(nodenamereset);
	} // end normal reset code
	palette_updateTable(true);
	sprite_updateTable(true);
	refresh();
	cycle = 0;
	testprogramAddress = 0;
	ioCounter = 0;
	handleIoBus(); // to get it properly synchronized
	chrAddress = 0;
	chrStatus['rd'] = 1;
	chrStatus['wr'] = 1;
	chrStatus['ale'] = 0;
	if(typeof expertMode != "undefined")
		updateLogList();
	chipStatus();
	if(ctrace)console.log('initChip done after ', now()-start);
}

function signalSet(n){
	var signals=[];
	for (var i=0; (i<=n)&&(i<presetLogLists.length) ; i++){
		for (var j=0; j<presetLogLists[i].length; j++){
			signals.push(presetLogLists[i][j]);
		}
	}
	return signals;
}

function updateLogList(names){
	// user supplied a list of signals, which we append to the set defined by loglevel
	logThese = signalSet(loglevel);
	if(typeof names == "undefined")
		// this is a UI call - read the text input
		names = document.getElementById('LogThese').value;
	else
		// this is an URL call - update the text input box
		document.getElementById('LogThese').value = names;
	names = names.split(/[\s,]+/);
	for(var i=0;i<names.length;i++){
		// could be a signal name, a node number, or a special name
		if(typeof busToString(names[i]) != "undefined")
			logThese.push(names[i]);
	}
	initLogbox(logThese);
}

var traceChecksum='';
var goldenChecksum;

// simulate a single clock phase, updating trace and highlighting layout
function step(){
/*
	var s=getState();
	var m=getMem();
	if(goldenChecksum != undefined)
		traceChecksum=adler32(traceChecksum+s+m.slice(0,511).toString(16));
*/
	halfStep();
	cycle++;
	chipStatus();
	updateVideo();
}

function stepDone(){
	if(animateChipLayout)
		refresh();

	var ab = readAddressBus();
	var spr = readSpriteAddr();
	if (isNodeHigh(nodenames['ale']))
		vram_selectCell(ab);
	sprite_selectCell(spr);
	if ((ab & 0x3F00) == 0x3F00)
		palette_selectCell(ab & 0x1F);
	palette_updateTable(true);
	sprite_updateTable(true);
}

vidVoltageNodes=['vid_0','vid_1','vid_2','vid_3','vid_4','vid_5','vid_6','vid_7','vid_8','vid_9','vid_10','vid_11'];
vidVoltage1=[5,9,12,16,16,24,25,27,36,37,45,45];
vidVoltage2=[5,9,10,16,13,24,19,22,28,29,35,35];
lastVidLevel = 0;

function updateVideo(){
	var scope = document.getElementById('vidscope');
	var ctx = scope.getContext("2d");
	var img = ctx.getImageData(1,0,scope.width-1,scope.height);
	ctx.clearRect(scope.width-1,0,1,scope.height);
	ctx.putImageData(img,0,0);
	ctx.beginPath();
	var next = -1;
	for (var i = 0; i < 12; i++)
	{
		if (isNodeHigh(nodenames[vidVoltageNodes[i]]))
		{
			if (next == -1)
			{
				if (isNodeHigh(nodenames['vid_emph']))
					next = vidVoltage2[i];
				else	next = vidVoltage1[i];
			}
			else	next = 50;
		}
	}
	if (next == -1)
		next = 0;

	if (lastVidLevel != 0)
	{
		if ((next == 0) || (next == 50))
			ctx.strokeStyle='red';
		else	ctx.strokeStyle='black';

		ctx.moveTo(scope.width,scope.height - lastVidLevel);
		ctx.lineTo(scope.width-1,scope.height - next);
		ctx.stroke();
	}
	lastVidLevel = next;
}

// triggers for breakpoints, watchpoints, input pin events
// almost always are undefined when tested, so minimal impact on performance
clockTriggers={};
writeTriggers={};
readTriggers={};

// simulate a single clock phase with no update to graphics or trace
function halfStep(){
	var clk = isNodeHigh(nodenames['clk0']);
	eval(clockTriggers[cycle]);
	handleIoBus();
	if (clk) {setLow('clk0');}
	else {setHigh('clk0');}
	handleChrBus();
}

function handleChrBus(){
	var newStatus = Array();
	newStatus['ale'] = isNodeHigh(nodenames['ale']);
	newStatus['rd'] = isNodeHigh(nodenames['rd']);
	newStatus['wr'] = isNodeHigh(nodenames['wr']);
	// rising edge of ALE
	if (!chrStatus['ale'] && newStatus['ale']){
		chrAddress = readAddressBus();
	}
	// falling edge of /RD - put bits on bus
	if (chrStatus['rd'] && !newStatus['rd']){
		var a = chrAddress;
		var d = eval(readTriggers[a]);
		if(d == undefined)
			d = mRead(a);
		writeBits('db', 8, d);
	}
	// rising edge of /RD - float the data bus
	if (!chrStatus['rd'] && newStatus['rd']){
		floatBits('db', 8);
	}
	// rising edge of /WR - store data in RAM
	if (!chrStatus['wr'] && newStatus['wr']){
		var a = chrAddress;
		var d = readDataBus();
		eval(writeTriggers[a]);
		mWrite(a,d);
	}
	chrStatus = newStatus;
}

// The I/O bus is attached to the CPU, so operate it the way a RP2A03 would
// Each I/O lasts 24 clock edges - cycle 0 for setup, cycle 9 for read/write, and cycle 24 for end
var ioParms;
function handleIoBus(){
	if ((ioCounter == 0) && (testprogramAddress < testprogram.length)) {
		cmd_highlightCurrent();
		ioParms = testprogram[testprogramAddress];

		if (ioParms & 0x3000)
			ioCounter = 24;
		else
		{
			ioCounter = ioParms & 0x7FF;
			floatBits('io_db', 8);
		}
	}
	if (ioCounter > 0) {
		var ce = (ioParms & 0x2000) >> 13;
		var rw = (ioParms & 0x1000) >> 12;
		var a = (ioParms & 0x700) >> 8;
		var d = (ioParms & 0xFF);
		if ((ioCounter == 24) && ce) {
			writeBits('io_ab', 3, a);
			if (rw) { floatBits('io_db', 8); }
			else { writeBits('io_db', 8, d); }
			writeBit('io_rw', rw);
		}
		if ((ioCounter == 16) && ce) {
			setLow('io_ce');
		}
		if (ioCounter == 1) {
			if (rw) {
				d = readBits('io_db', 8);
				// store result in the test program
				cmd_setCellValue(testprogramAddress*8+5, d);
			}
			setHigh('io_ce');
		}
		ioCounter--;
		if (ioCounter == 0)
			testprogramAddress++;
	}
}

var lastAddress = 0, lastData = 0;
function readAddressBus(){
	if (isNodeHigh(nodenames['ale']))
		lastAddress = readBits('ab', 14);
	return lastAddress;
}
function readDataBus(){
	if (!isNodeHigh(nodenames['rd']) || !isNodeHigh(nodenames['wr']))
		lastData = readBits('db', 8);
	return lastData;
}
function readSpriteAddr(){
	var spr1 = readBits('spr_addr', 8);
	var spr2 = readBits('spr_ptr', 6);
	if (spr2 & 0x20)
		return (spr2 & 0x1F) | 0x100;
	else	return spr1;
}

// for one-hot or few-hot signal collections we want to list the active ones
// and for brevity we remove the common prefix
function listActiveSignals(pattern){
	var r=new RegExp(pattern);
	var list=[];
	for(var i in nodenamelist){
		if(r.test(nodenamelist[i])) {
			if(isNodeHigh(nodenames[nodenamelist[i]]))
				// also map hyphen to a non-breaking version
				list.push(nodenamelist[i].replace(r,'').replace(/-/g,'&#8209'));
		}
	}
	return list;
}

function readBit(name){
	return isNodeHigh(nodenames[name])?1:0;
}
function readBits(name, n){
	var res = 0;
	for(var i=0;i<n;i++){
		var nn = nodenames[name+i];
		res+=((isNodeHigh(nn))?1:0)<<i;
	}
	return res;
}

function writeBit(name, x){
	if (x) {setHigh(name);}
	else {setLow(name);}
}

function writeBits(name, n, x){
	var recalcs = Array();
	for(var i=0;i<n;i++){
		var nn = nodenames[name+i];
		if((x%2)==0) {nodes[nn].pulldown=true; nodes[nn].pullup=false;}
		else {nodes[nn].pulldown=false; nodes[nn].pullup=true;}
		recalcs.push(nn);
		x>>=1;
	}
	recalcNodeList(recalcs);
}

function floatBits(name, n){
	var recalcs = Array();
	for(var i=0;i<n;i++){
		var nn = nodenames[name+i];
		nodes[nn].pulldown=false;
		nodes[nn].pullup=false;
		recalcs.push(nn);
	}
	recalcNodeList(recalcs);
}

function busToString(busname){
	// takes a signal name or prefix
	// returns an appropriate string representation
	// some 'signal names' are CPU-specific aliases to user-friendly string output
	if(busname=='cycle')
		return cycle >> 1;
	if(busname[0]=="-"){
		// invert the value of the bus for display
		var value=busToHex(busname.slice(1))
		if(typeof value != "undefined")
			return value.replace(/./g,function(x){return (15-parseInt(x,16)).toString(16)});
		else
			return undefined;;
	} else {
		return busToHex(busname);
	}
}

function busToHex(busname){
	// may be passed a bus or a signal, so allow multiple signals
	var width=0;
	var r=new RegExp('^' + busname + '[0-9]+$');
	for(var i in nodenamelist){
		if(r.test(nodenamelist[i])) {
			width++;
		}
	}
	if(width==0) {
		// not a bus, so could be a signal, a nodenumber or a mistake
		if(typeof nodenames[busname] != "undefined")
			return isNodeHigh(nodenames[busname])?"1":"0";
		if((parseInt(busname)!=NaN) && (typeof nodes[busname] != "undefined"))
			return isNodeHigh(busname)?"1":"0";
		return undefined;
	}
	if(width>16)
		return undefined;
	// finally, convert from logic values to hex
	return (0x10000+readBits(busname,width)).toString(16).slice(-(width-1)/4-1);
}

function mRead(a){
	if(memory[a]==undefined) return 0;
	else return memory[a];
}

function mWrite(a, d){
	vram_setCellValue(a, d);
	// mirror all writes
	for (var i = 0; i < 8; i++) memory[(a & 0x23FF) | (0x400*i)] = d;
}

function runChip(){
	var start = document.getElementById('start');
	var stop = document.getElementById('stop');
	start.style.visibility = 'hidden';
	stop.style.visibility = 'visible';
	if(typeof running == "undefined")
		initChip();
	running = true;
	go();
}

function stopChip(){
	var start = document.getElementById('start');
	var stop = document.getElementById('stop');
	start.style.visibility = 'visible';
	stop.style.visibility = 'hidden';
	running = false;
}

function resetChip(){
	stopChip();
	setStatus('resetting ' + chipname + '...');
	setTimeout(initChip,0);
}

function stepForward(){
	if(typeof running == "undefined")
		initChip();
	stopChip();
	step();
	stepDone();
}

function chipStatus(){
	var ab = readAddressBus();
	var spr = readSpriteAddr();
	var machine1 =
		' halfcyc:' + cycle +
		' clk:' + readBit('clk0') +
		' AB:' + hexWord(ab) +
		' D:' + hexByte(readDataBus());
	var machine2 =
		' Scanline: ' + readBits('vpos', 9) +
		' Pixel: ' + readBits('hpos', 9);
	var machine3 =
		'Hz: ' + estimatedHz().toFixed(1);
	if(typeof expertMode != "undefined") {
		if(goldenChecksum != undefined)
			machine3 += " Chk:" + traceChecksum + ((traceChecksum==goldenChecksum)?" OK":" no match");
	}
	setStatus(machine1, machine2, machine3);
	if (logThese.length>0) { updateLogbox(logThese); }
}

function goPixel()
{
	if(typeof running == "undefined")
		initChip();
	stopChip();
	var last = readBits('hpos', 9);
	while (last == readBits('hpos', 9))
		step();
	stepDone();
}

function goScanline()
{
	if(typeof running == "undefined")
		initChip();
	stopChip();
	var last = readBits('vpos', 9);
	while (last == readBits('vpos', 9))
		step();
	stepDone();
}

var prevHzTimeStamp=0;
var prevHzCycleCount=0;
var prevHzEstimate1=1;
var prevHzEstimate2=1;
var HzSamplingRate=10;

// return an averaged speed: called periodically during normal running
function estimatedHz(){
	if(cycle%HzSamplingRate!=3)
		return prevHzEstimate1;
	var HzTimeStamp = now();
	var HzEstimate = (cycle-prevHzCycleCount+.01)/(HzTimeStamp-prevHzTimeStamp+.01);
	HzEstimate=HzEstimate*1000/2; // convert from phases per millisecond to Hz
	if(HzEstimate<5)
		HzSamplingRate=5; // quicker
	if(HzEstimate>10)
		HzSamplingRate=10; // smoother
	prevHzEstimate2=prevHzEstimate1;
	prevHzEstimate1=(HzEstimate+prevHzEstimate1+prevHzEstimate2)/3; // wrong way to average speeds
	prevHzTimeStamp=HzTimeStamp;
	prevHzCycleCount=cycle;
	return prevHzEstimate1
}

// return instantaneous speed: called twice, before and after a timed run using goFor()
function instantaneousHz(){
	var HzTimeStamp = now();
	var HzEstimate = (cycle-prevHzCycleCount+.01)/(HzTimeStamp-prevHzTimeStamp+.01);
	HzEstimate=HzEstimate*1000/2; // convert from phases per millisecond to Hz
	prevHzEstimate1=HzEstimate;
	prevHzEstimate2=prevHzEstimate1;
	prevHzTimeStamp=HzTimeStamp;
	prevHzCycleCount=cycle;
	return prevHzEstimate1
}

var logbox;
function initLogbox(names){
	logbox=document.getElementById('logstream');
	if(logbox==null)return;

	for (var r = logbox.rows.length; r > 0; r--)
		logbox.deleteRow(r-1);
	var row = document.createElement('tr');

	names=names.map(function(x){return x.replace(/^-/,'')});
	names.forEach(function(x){
		var col = document.createElement('td');
		col.className = "header";
		col.appendChild(document.createTextNode(x));
		row.appendChild(col);
	});
	logbox.appendChild(row);
}

var logboxAppend=false;

// can append or prepend new states to the log table
// when we reverse direction we need to reorder the log stream
function updateLogDirection(){
	var loglines=[];
	logboxAppend=!logboxAppend;
	// the first element is the header so we can't reverse()
	for (var r = logbox.rows.length; r > 1; r--)
	{
		loglines.push(logbox.rows[r-1]);
		logbox.deleteRow(r-1);
	}
	for (var r = 0; r < loglines.length; r++)
		logbox.appendChild(loglines[r]);
}

// update the table of signal values, by prepending or appending
function updateLogbox(names){
	var signals=[];
	var odd=true;
	var bg;
	var row = document.createElement('tr');

	for(var i in names){
		var col = document.createElement('td');
		if(cycle % 4 < 2){
			col.className = odd ? "oddcol" : "";
		} else {
			col.className = odd ? "oddrow" : "oddrowcol";
		}
		col.appendChild(document.createTextNode(busToString(names[i])));
		row.appendChild(col);
		odd =! odd;
	}
	if(logboxAppend)
		logbox.appendChild(row);
	else
		logbox.insertBefore(row, logbox.rows[0].nextSibling);
}

function getMem(){
	var res = Array();
	for(var i=0;i<0x4000;i++) res.push(mRead(i));
	return res;
}

function setMem(arr){
	for(var i=0;i<0x4000;i++) mWrite(i, arr[i]);
}

function hexWord(n){return (0x10000+n).toString(16).substring(1)}
function hexByte(n){return (0x100+n).toString(16).substring(1)}

function adler32(x){
	var a=1;
	var b=0;
	for(var i=0;i<x.length;i++){
		a=(a+x.charCodeAt(i))%65521;
		b=(b+a)%65521;
	}
	return (0x100000000+(b<<16)+a).toString(16).slice(-8);
}
