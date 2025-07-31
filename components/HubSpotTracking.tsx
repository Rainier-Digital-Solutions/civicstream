'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

// Extend window type to include HubSpot tracking
declare global {
    interface Window {
        _hsq: any[];
    }
}

const HubSpotTracking = () => {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const searchParamsDict = Object.fromEntries(searchParams ? searchParams.entries() : []);

    const emailAddress = searchParamsDict.email ? searchParamsDict.email : null;
    var firstLoad = useRef(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            var _hsq = window._hsq = window._hsq || [];

            if (firstLoad.current === true) {
                _hsq.push(['setPath', pathname]);
                _hsq.push(['trackPageView']);

                if (emailAddress) {
                    _hsq.push(["identify", {
                        email: emailAddress
                    }]);
                }

                _hsq.push(['setPath', pathname]);
                _hsq.push(['trackPageView']);

                firstLoad.current = false;
            } else {
                _hsq.push(['setPath', pathname]);
                _hsq.push(['trackPageView']);
            }
        }
    }, [pathname, searchParamsDict, emailAddress]);

    return null;
};

export default HubSpotTracking;