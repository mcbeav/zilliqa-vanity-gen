const { fork } = require( "child_process" );

const path = require( "path" );
const fs = require( "fs" );

const argv = require( "minimist" )( process.argv.slice( 2 ) );

const colors = require( "colors/safe" );

const { Zilliqa } = require( "@zilliqa-js/zilliqa" );
const { toBech32Address } = require( "@zilliqa-js/crypto" );

const isSubprocess = typeof process.send !== "undefined";

const CWD = process.cwd();

const search = ( address, position ) => {

    try {

        let zilliqa = new Zilliqa( "https://dev-api.zilliqa.com" );

        let regex;
    
        position = ( position !== undefined ) ? String( position ).toLowerCase() : "start";
    
        switch( String( position ).toLowerCase() )
            {
    
                case "start":
                    regex = new RegExp( `zil1${address}`, "i" );
                    break;
    
                case "end":
                    regex = new RegExp( `${address}$`, "i" );
                    break;
    
                case "any":
                    regex = new RegExp( address, "gi" );
                    break;
    
                default:
                    regex = new RegExp( `zil1${address}`, "i" );
                    break;
    
            }
    
        let result;
        let counter = 0;
    
        while( !result ) {

            if( counter % 100000 === 0 ) {

                zilliqa = null;
    
                zilliqa = new Zilliqa( "https://dev-api.zilliqa.com" );
    
            }
    
            if( counter % 1000 === 0 ) {
    
                process.send({ counter: 1000 });
    
            }
    
            address = zilliqa.wallet.create();
    
            result = regex.test( toBech32Address( address ) );
    
            counter++;
    
        }
    
        if( result ) {
            process.send({ address: toBech32Address( address ), privateKey: zilliqa.wallet.accounts[ address ].privateKey, publicKey: zilliqa.wallet.accounts[ address ].publicKey, hex: zilliqa.wallet.accounts[ address ].address });
        }

    } catch( err ) {

        console.log( colors.red( err ) );

        process.exit( 0 );

    }

}

const progress = ( counter, address, position ) => {

    if( counter % 10000 === 0 ) {

        let msg;

        switch( position )
            {
                
                case "start":
                    msg = `${colors.yellow( "Searching For Zilliqa Address Starting With ")}${colors.green( address )}    |    ${colors.yellow("Addresses Checked: ")}${colors.red( counter )}`;
                    break;

                case "end":
                    msg = `${colors.yellow( "Searching For Zilliqa Address Ensing In ")}${colors.green( address )}    |    ${colors.yellow("Addresses Checked: ")}${colors.red( counter )}`;
                    break;

                case "any":
                    msg = `${colors.yellow( "Searching For Zilliqa Address Containing ")}${colors.green( address )}    |    ${colors.yellow("Addresses Checked: ")}${colors.red( counter )}`;
                    break;

                default:
                    msg = `${colors.yellow( "Searching For Zilliqa Address Starting With ")}${colors.green( address )}    |    ${colors.yellow("Addresses Checked: ")}${colors.red( counter )}`;
                    break;

            }

        console.clear();

        console.log( msg );

    }

}

const halt = ( children ) => {

    for( let i = 0; i < children.length; i++ )
        {

           children[ i ].kill( "SIGINT" ); 

        }

}

if( !isSubprocess ) {

    try {

        if( argv.address !== undefined ) {

            if( /^[A-Za-z0-9]*$/.test( argv.address ) ) {

                const children = [];

                let counter = 0;

                let threads = ( argv.threads !== undefined && Number( argv.threads ) > 0 ) ? Number( argv.threads ) : 1;

                let position = ( argv.position !== undefined ) ? String( argv.position ).toLowerCase() : "start";

                position = ( position === "start" || position === "end" || position === "any" ) ? position : "start";

                for( let i = 0; i < threads; i++ )
                    {
                        children[ i ] = fork( "./search.js" );

                        children[ i ].on( "message", ( msg ) => {

                            if( typeof msg.counter !== "undefined" ){

                                counter += msg.counter;

                                progress( counter, argv.address, position );

                            } else if( typeof msg.address !== "undefined" ) {

                                if( argv.hide === undefined ) {

                                    console.log( `${colors.yellow( msg.address )}    <=    (${colors.red( msg.privateKey )})` );

                                } else {

                                    const data =
                                        {
                                            address: msg.address,
                                            hexAddress: msg.hex,
                                            publicKey: msg.publicKey,
                                            privateKey: msg.privateKey
                                        }

                                    fs.writeFileSync( path.join( CWD, `${msg.address}.json` ), JSON.stringify( data, null, 2 ) );

                                    console.log( colors.green( `Account Details Saved To JSON File: `), colors.yellow( msg.address ) + ".json" );

                                }

                                halt( children );

                                process.exit( 0 );

                            }

                        });

                        children[ i ].on( "exit", () => {

                            console.log( `Child Process ${i} Exited` );

                        });

                        children[ i ].send({ address: argv.address, position: argv.position });
                    }

            } else {

                throw `Attempting Search With Invalid Characters. A Zilliqa Address Can Only Contain Letters & Numbers`;

            }

        } else {

            throw `--address Parameter Must Be Set When Running search.js`;
        }

    } catch( err ) {

        console.log( colors.red( err ) );

        process.exit( 0 );

    }

} else {

    process.on( "message", ( msg ) => {

        search( msg.address, msg.position );

    });

}