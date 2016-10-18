// Class prototype

var Class = function(methods) {   
    var klass = function() {    
        this.initialize.apply(this, arguments);          
    };  
    
    for (var property in methods) { 
       klass.prototype[property] = methods[property];
    }
          
    if (!klass.prototype.initialize) klass.prototype.initialize = function(){};      
    
    return klass;    
};

var Region = Class({ 
    initialize: function(x,y,z, name, color) {
		this.coords = [x,y,z];
		this.mapCoords = [0,0,0];
		this.name = name;	
		this.enabled = false; // User Location Only
		this.color = color;
    },
	updateCoords : function (x,y,z) { this.coords = [x,y,z];},
	getX : function() { return this.coords[0];},
	getY : function() { return this.coords[1];},
	getZ : function() { return this.coords[2];},
	getMapX : function() { return this.mapCoords[0];},
	getMapY : function() { return this.mapCoords[1];},
	getMapZ : function() { return this.mapCoords[2];},
	getVector : function (otherR){

		var v = { a: 0, b:0, m: 0};
		v.a = (otherR.getX() - this.getX());
		v.b = (otherR.getZ() - this.getZ());
		v.m = Math.sqrt((v.a*v.a) + (v.b*v.b));

		v.getDegreesVector = function(otherV) {
			var radians =  Math.atan2(otherV.b,otherV.a) - Math.atan2(this.b,this.a);
			return radians;
		}
		return v;
	},
	calculateDistance : function(otherR){
		var dX = otherR.getX() - this.getX();
		var dY = otherR.getY() - this.getY();
		var dZ = otherR.getZ() - this.getZ();
	
		var distance = Math.sqrt(dX*dX + dY*dY + dZ*dZ);
		return distance*100; // NMS stuff
	}
	
});

var center = new Region(2047,127,2047,'Galaxy Center','#7672E8' );
var pilgrim = new Region(0x64a,0x082,0x1b9,'Pilgrim Star','orange');
var userLocation = new Region(0x0,0x0,0x0,'User Location','#36AC3A');
var destinations = [new Region(0x64a,0x082,0x1b9,'Pilgrim Star','orange')]; // Store for destinations (include one)

var galSvg = undefined; // Main SVG
var compSvg = undefined; // Compass SVG
var coordSvg = undefined; // Coordinates SVG
var heightSvg = undefined // HeightMap SVG
var customDestination = false;


var svgImage = Class({
	
	initialize: function(domId, parentDomId, width, height) {

		this.parent = document.getElementById(parentDomId);
		
		this.svg = document.getElementById(domId);
		this.wp = width;
		this.hp = height;
		
		var aspect;
		
		if(width == undefined || width == null){		

			var parent = this.parent;
			
			aspect = (document.documentElement.clientHeight*1.0/document.documentElement.clientWidth);
			if(document.documentElement.clientHeight > document.documentElement.clientWidth){
				aspect = (document.documentElement.clientWidth*1.0/document.documentElement.clientHeight);
			}
			this.wp = parent.getBoundingClientRect().width * 0.9;
		}
		
		if(height == undefined || height == null){
			//this.hp = this.wp;
			this.hp = this.wp * aspect; 
		}
		
		this.svg.setAttribute("width",this.wp);
		this.svg.setAttribute("height",this.hp);
		
    },
	
	clearContent : function(){
		while (this.svg.firstChild) {
			this.svg.removeChild(this.svg.firstChild);
		}
	},
	
	addNode : function(type, attributes, content){
		var domObj = document.createElementNS("http://www.w3.org/2000/svg",type);
		for(i = 0;i<attributes.length;i+=2){
			domObj.setAttribute(attributes[i],""+attributes[i+1]);
		}
		if(content!=undefined && content!=null){
			domObj.innerHTML+=""+content;
		}
		this.svg.appendChild(domObj);
	},
	
	drawText : function(textStr, x,y, color, fontsize) {
		if(color == undefined || color == null){
			color = "white";
		}
		
		if(fontsize == undefined || fontsize == null){
			fontsize = "0.75em";
		}
		
		this.addNode("text", ["dy",fontsize,"x",x,"y",y,"fill",color],textStr);
	},
	
	drawArrow : function(x1,y1,x2,y2, stroke, fill){
		var color = 255;

		if(stroke == undefined || stroke == null){
			stroke = "stroke:rgb(255,255,255); stroke-width:1;";
		}
		
		if(fill == undefined || fill == null){
			fill = "white";
		}
		
		var document = 
		this.addNode("line", ["x1",x1,"y1",y1,"x2",x2,"y2",y2, "style",stroke]);
		
		var headlen = 10;   
		var angle = Math.atan2(y2-y1,x2-x1);	
		var pathText ="";
		pathText += Mustache.render("M{{a}} {{b}} ", {a: x2,b:y2});
		pathText += Mustache.render("L{{a}} {{b}} ", {a: x2-headlen*Math.cos(angle-Math.PI/6),b: y2-headlen*Math.sin(angle-Math.PI/6) });
		pathText += Mustache.render("L{{a}} {{b}} ", {a: x2-headlen*Math.cos(angle+Math.PI/6),b: y2-headlen*Math.sin(angle+Math.PI/6) });
		pathText+= " Z";
		this.addNode("path", ["d",pathText,"fill",fill]);

	}

});

function handlecustomlocation(){
	var checkObj = document.getElementById("usepilgrimswitch");
	var destTxt = document.getElementById("destinationlocation");
	if(checkObj.checked){
		customDestination = false;
		destinations[0].name = pilgrim.name;
		destinations[0].updateCoords(pilgrim.getX(),pilgrim.getY(), pilgrim.getZ());
		destTxt.value = "DOIT:064A:0082:01B9:0001";
		destTxt.disabled = true;
	}else{
		destTxt.value = "";
		destinations[0].name = "Destination";
		customDestination = true;
		destTxt.disabled = false;
	}	
}

function generateMap(){

	

	var re = new RegExp("to=[A-Z]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+:[0-9A-F]+");
	var res = re.exec(window.location.search);
	
	if(res!=null){
		var destTxt = document.getElementById("destinationlocation");
		var checkObj = document.getElementById("usepilgrimswitch");
		checkObj.checked = false;
		handlecustomlocation();
		destTxt.value = res[0].substr(3);
	}
	
	// Coordinates definition
	
	coordSvg = new svgImage("coordsvg","coordsvgp",null,100);
	coordSvg.drawCoords = function(x,y,z){
		
		var minx = 10;
		var maxx = 70;
		var miny = 70;
		var maxy = 10;
		
		var midx = 45;
		var midy = 35;

		this.clearContent();
		
		this.drawArrow(minx,miny, maxx,miny); // X axis
		this.drawArrow(minx,miny, minx,maxy); // Y axis
		this.drawArrow(minx,miny, midx,midy); // Z axis
				
		this.drawText("X coord: " +x,maxx+5,miny-10);
		this.drawText("Y coord: " +y,minx+5,maxy-10);
		this.drawText("Z coord: " +z,midx+10,midy-5);
		
	}
	
	// Compass definition
	
	compSvg = new svgImage("compasssvg","compassp",null,200);
	compSvg.drawCompass = function(radius,radians){		
		this.clearContent();
		var pos = [80,80];
		var degrees = (-1)*(radians*180/Math.PI);
		
		var x = pos[0];
		var y = pos[1]-radius;
		
		var transform = "rotate("+degrees+" 80 80)";
		
		this.addNode("circle",["cx",pos[0],"cy",pos[1],"r",radius,"style","stroke:rgb(153,153,153); stroke-width:2;","transform",transform]);
		this.addNode("line", ["x1",pos[0],"y1",pos[1],"x2",x,"y2",y, "style","stroke:rgb(123,123,230); stroke-width:2;"]);	
		this.addNode("line", ["x1",pos[0],"y1",pos[1],"x2",x,"y2",y, "style","stroke:rgb(255,0,0); stroke-width:4;","transform",transform]);		
		this.drawText("Center",75,10, center.color);
		
		var txt = document.getElementById("degreestxt");
		var txtDir = document.getElementById("degreesdirtxt");
		
		txt.innerHTML = ""+Math.abs(degrees).toFixed(2);
		txtDir.innerHTML = (degrees>0) ? "right" : "left";
		
	}

	// HeightMap definition
	
	heightSvg = new svgImage("heightsvg","heightsvgp",null,150);
	
	heightSvg.drawStar = function(obj, x, size){
		var centerX = x;
		var centerY = this.hp- (obj.mapCoords[1]* this.hp / 256);
		var fillStyle = obj.color;

		this.addNode("circle",["cx",centerX,"cy",centerY,"r",size,"stroke",fillStyle,"stroke-width","1","fill",fillStyle]);
		
		this.drawText(obj.name[0],centerX+10,centerY-10,obj.color);
		
	}
	
	heightSvg.drawGrid = function(){
		var step = 30;
		var localHtml = "";
		
		var color = 153; // 0x99

		for(var i = step;i<this.wp;i+=step){		
			this.addNode("line", ["x1",i,"y1",0,"x2",i,"y2",this.hp, "style","stroke:rgb(153,153,153); stroke-width:1;"]);		
		}
		for(var i = step;i<this.hp;i+=step){
			this.addNode("line", ["x1",0,"y1",i,"x2",this.wp,"y2",i, "style","stroke:rgb(153,153,153); stroke-width:1;"]);
		}

	};
	heightSvg.drawSvg = function(){
			this.clearContent();	
			this.drawGrid();
			this.drawArrow(5,this.hp-2, 5,20);
			this.drawText("Y",15,20)
			this.drawStar(userLocation,50,4);
			
			for(var i = 0;i<destinations.length;i++){
				this.drawStar(destinations[i],(i*30)+100,4);	
			}
	}
	
	// Gal Map definition
	galSvg = new svgImage("svgc","svgp",undefined, undefined);
	
	galSvg.transformCoords = function (obj){
			var mX = 4096;
			var mZ = 4096;
			obj.mapCoords[0] = obj.coords[0] * this.wp / mX;
			obj.mapCoords[1] = obj.coords[1];
			obj.mapCoords[2] = obj.coords[2] * this.hp / mZ;
	};
				
	galSvg.drawGrid = function(){
		var step = 30;
		var localHtml = "";
		
		var color = 153; // 0x99

		for(var i = step;i<this.wp;i+=step){		
			this.addNode("line", ["x1",i,"y1",0,"x2",i,"y2",this.hp, "style","stroke:rgb(153,153,153); stroke-width:1;"]);		
		}
		for(var i = step;i<this.hp;i+=step){
			this.addNode("line", ["x1",0,"y1",i,"x2",this.wp,"y2",i, "style","stroke:rgb(153,153,153); stroke-width:1;"]);
		}

	};
		
	galSvg.drawStar = function(obj,size){
		var centerX = obj.getMapX();
		var centerZ = obj.getMapZ();
		var fillStyle = obj.color;
		this.addNode("circle",["cx",centerX,"cy",centerZ,"r",size,"stroke",fillStyle,"stroke-width","1","fill",fillStyle]);
	};
			
	galSvg.drawAxis = function (){
		this.drawText("X",140,25);
		this.drawArrow(10,10,150,10);
		this.drawText("Z",18,150);
		this.drawArrow(10,10,10,150);
	}
	
	galSvg.drawSvg = function(){
			this.clearContent();	
			this.drawGrid();
			this.drawAxis();
			
			this.transformCoords(center);
			
			this.transformCoords(userLocation);
			
			for(var i = 0;i<destinations.length;i++){
				this.transformCoords(destinations[i]);	
			}
			
			this.drawStar(center,6);

			if(userLocation.enabled){
				this.drawStar(userLocation,4);
				
				for(var i = 0;i<destinations.length;i++){ // Draw all locations from user
					this.drawStar(destinations[i],4);
				}
				
				var v1 = center.getVector(userLocation); 
				var v2 = center.getVector(destinations[0]);

				var angle = v1.getDegreesVector(v2);		
				
				compSvg.initialize("compasssvg","compassp",null,200);
				compSvg.drawCompass(50,angle);
				
				heightSvg.initialize("heightsvg","heightsvgp",null,150);
				heightSvg.drawSvg();
				
			}
	};
	
	galSvg.drawSvg(); // Draw it
	
}

function hideMessages(){
	var elementA = document.getElementById("errorMessage");
	var elementB = document.getElementById("locationInfo");
	var elementC = document.getElementById("directionsmap");
	
	elementA.className = elementA.className + " hidden";
	elementB.className = "hidden";
	elementC.className = "hidden";
}

function showErrorMessage(text){
	var element = document.getElementById("errorMessage");
	element.className = "card indigo";
	var elementText = document.getElementById("errorMessageText");
	elementText.innerHTML = text;
}

function setValue(domId,value){
	var element = document.getElementById(domId);
	element.innerHTML = value;
}

function showLocationInfo(x,y,z){
	var element = document.getElementById("locationInfo");
	element.className = "visible";
	
	var elementB = document.getElementById("directionsmap");
	elementB.className = "visible";
	
	userLocation.updateCoords(x,y,z);

	setValue("cdistance", userLocation.calculateDistance(center).toFixed(3) +" ly");
	setValue("pdistance",userLocation.calculateDistance(destinations[0]).toFixed(3) +" ly");
	setValue("pjumps",Math.ceil(userLocation.calculateDistance(destinations[0])/400.0));
	
	coordSvg.initialize("coordsvg","coordsvgp",null,100);
	coordSvg.drawCoords(x,y,z);
	
	galSvg.drawSvg();
	
}

function calculateLocation(){
	var elementValue = document.getElementById("userlocation").value;
	var data = elementValue.split(':');
	
	hideMessages();
	userLocation.enabled = false;
	
	if(data.length!=5){
		showErrorMessage("Invalid format for location");
		return;
	}
	
	var x = Number("0x"+data[1]);
	var y = Number("0x"+data[2]);
	var z = Number("0x"+data[3]);
	
	if(isNaN(x) || isNaN(y) || isNaN(z)){
		showErrorMessage("Invalid format for location");
		return;
	}
	
	// Check destination (if any)
	
	if(customDestination){
		elementValue = document.getElementById("destinationlocation").value;
		var lines = elementValue.split('\n')

		destinations.splice(0,destinations.length);
		
		for(var i = 0;i<lines.length;i++){
		
			var data = lines[i].split(':');
		
			if(data.length!=5){
				showErrorMessage("Invalid format for destination");
				return;
			}
			
			var dx = Number("0x"+data[1]);
			var dy = Number("0x"+data[2]);
			var dz = Number("0x"+data[3]);
			
			if(isNaN(dx) || isNaN(dy) || isNaN(dz)){
				showErrorMessage("Invalid format for destination");
				return;
			}
			
			destinations.push(new Region(dx,dy,dz,'Destination '+(i+1),'orange'));
		}
	}

	userLocation.enabled = true;
	showLocationInfo(x,y,z);	
}

