declare module 'react-world-flags' {
    import * as React from 'react';
    interface FlagProps extends React.ImgHTMLAttributes<HTMLImageElement> {
        code: string;
        fallback?: React.ReactNode;
    }
    const Flag: React.FC<FlagProps>;
    export default Flag;
}
