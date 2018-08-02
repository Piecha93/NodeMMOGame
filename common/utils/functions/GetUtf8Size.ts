//TODO refacor to typescript
export function getUTF8Size( str ) {
    return str.split('')
        .map(function( ch ) {
            return ch.charCodeAt(0);
        }).map(function( uchar ) {
            // The reason for this is explained later in
            // the section “An Aside on Text Encodings”
            return uchar < 128 ? 1 : 2;
        }).reduce(function( curr, next ) {
            return curr + next;
        });
}