"""Expected fresh commerce for native browser-save migration assertions."""


def fresh_market(day):
    return {
        'startedDay':day, 'round':0,
        'nextReviewDay':day+90,
        'nextRivalDay':day+15,
        'buyers':{
            'lunar-return':{'openT':300,'playerCommittedT':0,'rivalCommittedT':0},
            'mars-build':{'openT':600,'playerCommittedT':0,'rivalCommittedT':0},
            'mercury-tooling':{'openT':600,'playerCommittedT':0,'rivalCommittedT':0},
        },
        'nextShipment':1, 'flights':[],
        'rivalDeliveredT':{'selene':0,'vector':0}, 'history':[],
    }


def empty_commerce(day):
    return {
        'credits':0,'earnedCredits':0,'spentCredits':0,'nextContract':1,
        'contracts':[], 'cooldowns':{'lunar-return':0,'mars-build':0,'mercury-tooling':0},
        'market':fresh_market(day),
    }
