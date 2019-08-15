/**
 * Created by kraig on 3/11/16.
 */

const inherits = require('util').inherits;
let Accessory, Service, Characteristic, uuid;

'use strict';

module.exports = function(exportedTypes) {
    if (exportedTypes && !Accessory) {
        Accessory = exportedTypes.Accessory;
        Service = exportedTypes.Service;
        Characteristic = exportedTypes.Characteristic;
        uuid = exportedTypes.uuid;

        const acc = NestDeviceAccessory.prototype;
        inherits(NestDeviceAccessory, Accessory);
        NestDeviceAccessory.prototype.parent = Accessory.prototype;
        for (const mn in acc) {
            NestDeviceAccessory.prototype[mn] = acc[mn];
        }
    }
    return NestDeviceAccessory;
};

// Base type for Nest devices
function NestDeviceAccessory(conn, log, device, structure, platform) {

    // device info
    this.conn = conn;
    this.name = device.name_long || device.name;
    this.deviceId = device.device_id;
    this.log = log;
    this.device = device;
    this.structure = structure;
    this.structureId = structure.structure_id;
    this.platform = platform;

    this.log('initing ' + this.deviceType + ' "' + this.name + '":', 'deviceId:', this.deviceId, 'structureId:', this.structureId);
    this.log.debug(this.device);

    const id = uuid.generate('nest' + '.' + this.deviceType + '.' + this.deviceId);
    Accessory.call(this, this.name, id);
    this.uuid_base = id;

    this.getService(Service.AccessoryInformation)
        .setCharacteristic(Characteristic.FirmwareRevision, this.device.software_version)
        .setCharacteristic(Characteristic.Manufacturer, 'Nest')
        .setCharacteristic(Characteristic.Model, this.deviceDesc)
        .setCharacteristic(Characteristic.Name, this.name)
        .setCharacteristic(Characteristic.SerialNumber, this.device.serial_number);

    this.boundCharacteristics = [];

    this.updateData();
}

NestDeviceAccessory.prototype.getServices = function () {
    return this.services;
};

NestDeviceAccessory.prototype.bindCharacteristic = function (service, characteristic, desc, getFunc, setFunc, format) {
    const actual = service.getCharacteristic(characteristic)
        .on('get', function (callback) {
            const val = getFunc.bind(this)();
            if (callback) callback(null, val);
        }.bind(this))
        .on('change', function (change) {
            let disp = change.newValue;
            if (format && disp !== null) {
                disp = format(disp);
            }
            this.log.debug(desc + ' for ' + this.name + ' is: ' + disp);
        }.bind(this));
    if (setFunc) {
        actual.on('set', setFunc.bind(this));
    }
    this.boundCharacteristics.push([service, characteristic]);
};

NestDeviceAccessory.prototype.updateData = function (device, structure) {
    if (device) {
        this.device = device;
    }
    if (structure) {
        this.structure = structure;
    }
    this.boundCharacteristics.map(function (c) {
        c[0].getCharacteristic(c[1]).getValue();
    });
};

NestDeviceAccessory.prototype.setPropertyAsync = function(type, property, value, propertyDescription, valueDescription, doNotUpdateLocalProperty) {
    propertyDescription = propertyDescription || property;
    valueDescription = valueDescription || value;
    this.log.debug('Setting ' + propertyDescription + ' for ' + this.name + ' to: ' + valueDescription);
    if (!doNotUpdateLocalProperty) {
        this.device[property] = value;
    }

    switch (type) {
    case 'structure': // Structure
        return this.conn.update(type + '.' + this.structureId, property, value, this.device.hvac_mode).return(value);
    case 'device':    // Thermostat
    case 'shared':    // Thermostat
    case 'topaz':     // Protect
    case 'kryptonite':     // Temperature Sensor
        return this.conn.update(type + '.' + this.deviceId, property, value, this.device.hvac_mode).return(value);
    default:
        this.log.debug('Could not set property - unknown type: ' + type);
        return null;
    }
};
