###############################################################################
# fermormance.nas by Tatsuhiro Nishioka
# - Performance Monitor for developing JSBSim models
# 
# Copyright (C) 2009 Tatsuhiro Nishioka (tat dot fgmacosx at gmail dot com)
# This file is licensed under the GPL version 2 or later.
# 
# How to use:
#  You can use performance Monitor by pressing Ctrl-Shift-M
#  
# Developer's Guide
#  To add a new monitor, you can make a class derived from MonitorBase, 
#  and implement reinit, start, pdate, and properties methods.
#  Then, register an instance of the class to PerformanceMonitor instance.
#
###############################################################################

var printf = func { print(call(sprintf, arg)) }

#
# calculate distance between two position in meter.
# pos is a hash with lat and lon (e.g. { lat : lattitude, lon : longitude })
#
var calcDistance = func(pos1, pos2) {
  var dlat = pos2.lat - pos1.lat;
  var dlon = pos2.lon - pos1.lon;

  var dlat_m = dlat * 111120;
  var dlon_m = dlon * math.cos(pos1.lat / 180 * math.pi) * 111120;
  var dist_m = math.sqrt(dlat_m * dlat_m + dlon_m * dlon_m);
  return dist_m;
}


#
# MonitorBase
# Base class for performance monitors
# You can make a monitor class derived from this
# for some unused methods. All methods are called
# from PerformanceMonitor class.
#
var MonitorBase = {};
MonitorBase.reinit = func() {} # called when /sim/signals/reinit is set
MonitorBase.start = func() {}  # 
MonitorBase.update = func() {}
MonitorBase.properties = func() { return []; }


#
# MiscMonitor
# This shows some useful info during test
#
var MiscMonitor= {};
MiscMonitor.new = func()
{
  var obj = { parents : [ MiscMonitor, MonitorBase ]};
  return obj;
}

MiscMonitor.properties = func() {
  return [
    { property : "rpm",          name : "RPM",                   format : "%5.1f", unit : "r/min",  halign : "right" },
    { property : "temp",         name : "Cockpit temperature",   format : "%2.1f", unit : "dec C",  halign : "right" },
    { property : "outlet",       name : "Outlet temperature",    format : "%3.1f", unit : "deg C",  halign : "right" },
  ]
}

MiscMonitor.update = func()
{
  setprop("/sim/gui/dialogs/systems-monitor/rpm", getprop("fdm/jsbsim/propulsion/engine/rpm_r-min"));
  setprop("/sim/gui/dialogs/systems-monitor/temp", getprop("environment/temperature-inside-degc"));
  setprop("/sim/gui/dialogs/systems-monitor/outlet", getprop("fdm/jsbsim/propulsion/engine/outlet-temperature-degc"));
}

MiscMonitor.reinit = func() {

}


var miscMonitor = nil;

#
# PerformanceMonitor
# A framework for monitoring aircraft performance
#
var SystemsMonitor = { _instance : nil };

#
# The singleton Instance for PerformanceMonitor
# You can call PerformanceMonitor.instance() to 
# obtain the only instance for this class.
#
SystemsMonitor.instance = func()
{
  if (SystemsMonitor._instance == nil) {
    SystemsMonitor._instance = { parents : [ SystemsMonitor ] };
    SystemsMonitor._instance.monitors = [];
  }
  return SystemsMonitor._instance;
}

#
# register: for registering a new monitor instance.
# this class will take care of monitoring and showing properties
# or calculated values on the dialog by regisering a monitor instance.
#
SystemsMonitor.register = func(monitor)
{
  append(me.monitors, monitor);
  foreach (var property; monitor.properties()) {
    MonitorDialog.instance().addProperty(property);
  }
}

#
# update: calls update method of each monitor
#   this method is called 10 times a second.
#
SystemsMonitor.update = func() {
  foreach (var monitor; me.monitors) {
    monitor.update();
  } 
  settimer(func { SystemsMonitor.instance().update(); }, 0.1);
}

#
# reinit : calls reinit method of each monitor
#   when /sim/signals/reinit is set
#
SystemsMonitor.reinit = func() {
  foreach (var monitor; me.monitors) {
    monitor.reinit();
  }
}

#
# start: calls start method of each monitor
#   when Ctrl-Shift-M is pressed.
#
SystemsMonitor.start = func() {
  foreach (var monitor; me.monitors) {
    monitor.start();
  }
  MonitorDialog.instance().show();
  me.update();
}

#
# initialize: creates and registers instances of monitor classes
#
var initialize = func() {
  setprop("/sim/gui/dialogs/systems-monitor/init", 1);
  #var keyHandler = KeyHandler.new();
  var monitor = SystemsMonitor.instance();
  #monitor.register(TakeoffDistance.new());
  #monitor.register(LandingDistance.new());
  monitor.register(MiscMonitor.new());
  #monitor.register(FuelEfficiency.new(1));
  #monitor.register(AeroMonitor.new());
  # Ctrl-Shift-M to activate Performance Monitor
  #keyHandler.add(13, KeyHandler.CTRL + KeyHandler.SHIFT, func { PerformanceMonitor.instance().start(); });
  # Ctrl-Shift-C to reinit Performance Monitor
  #keyHandler.add(3, KeyHandler.CTRL + KeyHandler.SHIFT, func { PerformanceMonitor.instance().reinit(); });
  #screen.log.write("Performance Monitor is available.");
  #screen.log.write("Press Ctrl-Shift-M to activate.");
}

setlistener("/sim/signals/fdm-initialized", func { settimer(initialize, 1); }, 0, 0);
setlistener("/sim/signals/reinit", func { SystemsMonitor.instance().reinit(); }, 0, 0);