"use strict";

var _ = require( "./lib/lodash" );
var sprintf = require( "./lib/sprintf" ).sprintf;

function repeat( times, callback ) {
    for( var i = 0; i < times; ++i ) {
        callback( i );
    }
}

function assert_range( min, max, value, name ) {
    if( !_.isUndefined( name ) ) {
        name = " '" + name + "'";
    }

    if( !_.isNumber( value ) ) {
        throw new Error( "Argument" + name + " not a number" );
    }

    if( value < min || value > max ) {
        throw new Error( "Argument" + name + " out of range: " + value );
    }
}

function assert_bool( value, name ) {
    if( !_.isUndefined( name ) ) {
        name = " '" + name + "'";
    }

    if( !_.isBoolean( value ) ) {
        throw new Error( "Argument" + name + " not a bool" );
    }
}

function assert_array( value, name ) {
    if( !_.isUndefined( name ) ) {
        name = " '" + name + "'";
    }

    if( !_.isArray( value ) ) {
        throw new Error( "Argument" + name + " not an array" );
    }
}

phantom.onError = function( message, trace ) {
    var message_stack = ["PHANTOM ERROR: " + message];
    if( trace && trace.length ) {
        message_stack.push( "TRACE:" );
        _.each( trace, function( entry ) {
            message_stack.push(' -> ' + (entry.file || entry.sourceURL) + ': ' + entry.line + (entry.function ? ' (in function ' + entry.function + ')' : ''));
        });
    }
    console.log( message_stack.join( "\n" ) );
    phantom.exit( 1 );
};

function create( callback ) {
    var page = require( "webpage" ).create();
    page.viewportSize = {
        width: 1280,
        height: 720
    };

    var last_callback_id = 0;
    var callbacks = {};

    var self = {
        exit: function() {
            phantom.exit();
        },

        step_pixel: function() {
            page.evaluate( function() {
                goPixel();
            });

            self.on_step_pixel_called();
        },

        step_scanline: function() {
            page.evaluate( function() {
                goScanline();
            });

            self.on_step_scanline_called();
        },

        reset: function() {
            page.evaluate( function() {
                resetChip();
            });
        },

        screenshot: function( filename ) {
            page.evaluate( function() {
                for( var addr = 0; addr <= 0x23ff; ++addr ) {
                    original_vram_setCellValue( addr, memory[ addr ] );
                }
                cmd_setupTable();
                original_cmd_highlightCurrent();
                original_chipStatus();
                original_stepDone();
            });
            page.render( filename );
        },

        read_oam: function( offset ) {
            assert_range( 0, 0xFF, offset, "offset" );

            return page.evaluate( function( offset ) {
                return sprite_read( offset );
            }, offset );
        },

        write_oam: function( offset, value ) {
            assert_range( 0, 0xFF, offset, "offset" );
            assert_range( 0, 0xFF, value, "value" );

            page.evaluate( function( offset, value ) {
                sprite_write( offset, value );
            }, offset, value );

            self.on_write_oam_called( offset, value );
        },

        write_sprite_to_oam: function( n_sprite, value ) {
            assert_range( 0, 7, n_sprite, "n_sprite" );
            assert_array( sprite, "value" );
            assert_range( 4, 4, value.length, "value.length" );

            repeat( 4, function( offset ) {
                self.write_oam( n_sprite * 4 + offset, value[offset] );
            });
        },

        read_secondary_oam: function( offset ) {
            assert_range( 0, 32, offset, "offset" );

            return page.evaluate( function( offset ) {
                return sprite_read( 0x100 + offset );
            }, offset );
        },

        write_secondary_oam: function( offset, value ) {
            assert_range( 0, 32, offset, "offset" );
            assert_range( 0, 0xFF, value, "value" );

            page.evaluate( function( offset, value ) {
                sprite_write( 0x100 + offset, value );
            }, offset, value );

            self.on_write_secondary_oam_called( offset, value );
        },

        write_sprite_to_secondary_oam: function( n_sprite, value ) {
            assert_range( 0, 7, n_sprite, "n_sprite" );
            assert_array( value, "value" );
            assert_range( 4, 4, value.length, "value.length" );

            repeat( 4, function( offset ) {
                self.write_secondary_oam( n_sprite * 4 + offset, value[offset] );
            });
        },

        read_palette_ram: function( offset ) {
            assert_range( 0, 32, offset, "offset" );

            return page.evaluate( function( offset ) {
                return palette_read( offset );
            }, offset );
        },

        write_palette_ram: function( offset, value ) {
            assert_range( 0, 32, offset, "offset" );
            assert_range( 0, 0xFF, value, "value" );

            page.evaluate( function( offset, value ) {
                palette_write( offset, value );
            }, offset, value );

            self.on_write_palette_ram_called( offset, value );
        },

        read_vram: function( offset ) {
            return page.evaluate( function( address ) {
                return mRead( address );
            }, address );
        },

        write_vram: function( address, value ) {
            assert_range( 0, 0x3FFF, address, "address" );
            assert_range( 0, 0xFF, value, "value" );

            page.evaluate( function( address, value ) {
                mWrite( address, value );
            }, address, value );

            self.on_write_vram_called( address, value );
        },

        dump_oam: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 256 );
                for( var i = 0; i < 256; ++i ) {
                    output[ i ] = sprite_read( i );
                }

                return output;
            });
        },

        dump_secondary_oam: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 32 );
                for( var i = 0; i < 32; ++i ) {
                    output[ i ] = sprite_read( 0x100 + i );
                }

                return output;
            });
        },

        dump_palette_ram: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 32 );
                for( var i = 0; i < 32; ++i ) {
                    output[ i ] = palette_read( i );
                }

                return output;
            });
        },

        dump_vram: function() {
            return page.evaluate( function( offset, value ) {
                var output = new Array( 0x4000 );
                for( var i = 0; i < 0x4000; ++i ) {
                    output[ i ] = mRead( i );
                }

                return output;
            });
        },

        get_scanline: function() {
            return self.read_bits( "vpos" );
        },

        get_dot: function() {
            return self.read_bits( "hpos" );
        },

        get_position: function() {
            return position( self.get_scanline(), self.get_dot() );
        },

        get_address_bus: function() {
            return page.evaluate( function() {
                return readAddressBus();
            });
        },

        get_data_bus: function() {
            return page.evaluate( function() {
                return readDataBus();
            });
        },

        read_bits: function( node_name ) {
            return page.evaluate( function( node_name ) {
                if( nodenames[ node_name + "0" ] === undefined ) {
                    return readBit( node_name );
                }

                var bit_count = 0;
                while( nodenames[ node_name + (bit_count + 1) ] != undefined ) {
                    bit_count += 1;
                }

                return readBits( node_name, bit_count + 1 );
            }, node_name );
        },

        is_reading_from_vram: function() {
            return self.read_bits( "rd" ) === 0;
        },

        is_writing_to_vram: function() {
            return self.read_bits( "wr" ) === 0;
        },

        resolve_io_port: function() {
            if( arguments.length !== 1 && arguments.length !== 2 ) {
                throw new Error( "Invalid argument count" );
            }

            var obj = arguments[0];
            if( obj === ppumask ) {
                obj = ppumask();
            }

            if( !_.isObject( obj ) ) {
                obj = {
                    address: arguments[0]
                }
            }

            if( arguments.length === 2 && !_.isUndefined( arguments[1] ) ) {
                obj.value = arguments[1];
            }

            if( obj.address < 0x2000 || obj.address > 0x3FFF ) {
                throw new Error( "Address out of range: " + obj.address );
            }

            if( !_.isUndefined( obj.value ) && obj.value < 0 || obj.value > 255 ) {
                throw new Error( "Value out of range: " + obj.value );
            }

            obj.address = 0x2000 + (obj.address & (8 - 1));
            return obj;
        },

        queue_cpu_read: function( address, callback ) {
            address = self.resolve_io_port( address ).address;

            var callback_id = null;
            if( !_.isUndefined( callback ) ) {
                callback_id = ++last_callback_id;
                callbacks[ callback_id ] = callback;
            }

            return page.evaluate( function( address, callback_id ) {
                var entry = (address << 8) | 0x3000;
                queue_cpu_action( entry, callback_id );
            }, address, callback_id );
        },

        queue_cpu_write: function( address, value ) {
            var obj = self.resolve_io_port( address, value );

            page.evaluate( function( address, value ) {
                var entry = value | (address << 8) | 0x2000;
                queue_cpu_action( entry );
            }, obj.address, obj.value );

            self.on_cpu_write_called( obj.address, obj.value );
        },

        cpu_write_and_step: function( address, value ) {
            self.queue_cpu_write( address, value );
            return self.step_until_one_cpu_operation_is_executed();
        },

        step_until_one_cpu_operation_is_executed: function() {
            var get_address = function() {
                return page.evaluate( function() { return testprogramAddress; } );
            };
            var length = page.evaluate( function() { return testprogram.length } );
            var initial_address = get_address();
            var count = 0;

            while( true ) {
                var address = get_address();

                if( address == (length - 1) || address == (initial_address + 1) ) {
                    break;
                }

                self.step_pixel();
                count += 1;
            }

            return count;
        },

        on_write_vram_called: function( address, value ) {},
        on_write_palette_ram_called: function( offset, value ) {},
        on_write_oam_called: function( offset, value ) {},
        on_write_secondary_oam_called: function( offset, value ) {},
        on_cpu_write_called: function( address, value ) {},
        on_step_pixel_called: function() {},
        on_step_scanline_called: function() {},

        repeat: repeat
    };

    page.onConsoleMessage = function( message ) {
        console.log( message );
    };

    page.onCallback = function( data ) {
        callbacks[ data.callback_id ]( data.value );
        delete callbacks[ data.callback_id ];
    };

    var initialize = function() {
        page.evaluate( function() {
            updateChipLayoutAnimation( false );
            updateChipLayoutVisibility( false );
            updateVideo = function() {};
            updateLogbox = function() {};
            original_chipStatus = chipStatus;
            chipStatus = function() {};
            document.getElementById( "tracingdiv" ).style.display = "none";

            original_stepDone = stepDone;
            stepDone = function() {};

            original_vram_setCellValue = vram_setCellValue;
            vram_setCellValue = function() {};

            original_cmd_highlightCurrent = cmd_highlightCurrent;
            cmd_highlightCurrent = function() {};

            original_cmd_setCellValue = cmd_setCellValue;
            cmd_setCellValue = function( which, value ) {
                which = ((which - 5) / 8);
                var callback_id = callback_ids[ which ];
                if( callback_id !== null ) {
                    window.callPhantom( { callback_id: callback_id, value: value } );
                }
            };

            callback_ids = {};
            testprogram = [0];
            ioParms = 0;

            queue_cpu_action = function( entry, callback_id ) {
                if( testprogram[ testprogram.length - 1 ] === 0 ) {
                    testprogram.pop();
                }
                if( testprogramAddress >= testprogram.length ) {
                    testprogramAddress = testprogram.length;
                }
                callback_ids[ testprogramAddress ] = callback_id;
                testprogram.push( entry );
                testprogram.push( 0 );
            };
        });
    };

    page.open( "visual2c02/index.html", function( status ) {
        if( status !== "success" ) {
            console.log( "INTERNAL ERROR: Page load failed!" );
            phantom.exit();
        }

        page.evaluate( function() {
            // This is called in initChip() which screws up our queued CPU read/writes.
            proper_handleIoBus = handleIoBus;
            handleIoBus = function() {
                handleIoBus = proper_handleIoBus;
            }

            chipLayoutIsVisible = false;
        });

        var wait = function() {
            var status = page.evaluate( function() {
                return document.getElementById('status').innerText;
            });

            if( _.startsWith( status, "halfcyc:" ) ) {
                initialize();
                callback( self );
            } else {
                setTimeout( wait, 25 );
            }
        }

        setTimeout( wait, 25 );
    });
}

function accessor( obj, bit, key ) {
    obj[ key ] = function() {
        return obj.value & (1 << bit);
    };

    obj[ "set_" + key ] = function( value ) {
        obj.value = (obj.value & (~(1 << bit))) | ((value & 1) << bit);
        return obj;
    };
}

function ppumask( value ) {
    var obj = { address: 0x2001, value: value };
    accessor( obj, 0, "greyscale" );
    accessor( obj, 1, "show_background_in_leftmost_8_pixels" );
    accessor( obj, 2, "show_sprites_in_leftmost_8_pixels" );
    accessor( obj, 3, "show_background" );
    accessor( obj, 4, "show_sprites" );
    accessor( obj, 5, "emphasize_red" );
    accessor( obj, 6, "emphasize_green" );
    accessor( obj, 7, "emphasize_blue" );

    return obj;
}

function sprite( args ) {
    var x = null,
        y = null,
        tile = null,
        palette = 0,
        flip_h = false,
        flip_v = false,
        low_priority = false;

    _.each( args, function( value, key ) {
        if( key === "x" ) {
            assert_range( 0, 0xFF, value, key );
            x = value;
        } else if( key === "y" ) {
            assert_range( 0, 0xFF, value, key );
            y = value;
        } else if( key === "tile" ) {
            assert_range( 0, 0xFF, value, key );
            tile = value;
        } else if( key === "palette" ) {
            assert_range( 0, 3, value, key );
            palette = value;
        } else if( key === "flip_h" ) {
            assert_bool( value, key );
            flip_h = value;
        } else if( key === "flip_v" ) {
            assert_bool( value, key );
            flip_v = value;
        } else if( key === "low_priority" || key === "display_behind_background" ) {
            assert_bool( value, key );
            low_priority = value;
        } else {
            throw new Error( "Unknown argument key: '" + key + "' (value=" + JSON.stringify( value ) + ")" );
        }
    });

    if( _.isUndefined( x ) ) {
        throw new Error( "Missing 'x'" );
    }

    if( _.isUndefined( y ) ) {
        throw new Error( "Missing 'y'" );
    }

    if( _.isUndefined( tile ) ) {
        throw new Error( "Missing 'tile'" );
    }

    var attributes = palette;
    if( flip_h === true ) {
        attributes |= 1 << 6;
    }

    if( flip_v === true ) {
        attributes |= 1 << 7;
    }

    if( low_priority === true ) {
        attributes |= 1 << 5;
    }

    return [y, tile, attributes, x];
}

function position( scanline, dot ) {
    var self = {
        scanline: scanline,
        dot: dot,

        add: function( difference ) {
            var scanline = self.scanline;
            var dot = self.dot;

            dot += difference;
            if( dot < 0 ) {
                scanline -= 1;
                dot = 340;
                if( scanline < 0 ) {
                    scanline = 261;
                }
            } else if( dot > 340 ) {
                scanline += 1;
                dot = 0;
                if( scanline > 262 ) {
                    scanline = 0;
                }
            }

            return position( scanline, dot );
        },

        toString: function() {
            return sprintf( "%03i %03i", self.scanline, self.dot );
        }
    };

    return self;
}

module.exports.create = create;
module.exports.ppumask = ppumask;
module.exports.sprite = sprite;
module.exports.repeat = repeat;
module.exports.position = position;
