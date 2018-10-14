import React, { Component } from "react"
import { map, assign } from "lodash"
import { Pagination, PaginationItem, PaginationLink } from "reactstrap"
import redirect from "../utils/redirect.jsx"
import PropTypes from "prop-types"

class Pag extends Component {
    constructor (props) {
        super(props)
        this.getPagination = this.getPagination.bind(this);
        this.redirect = this.redirect.bind(this);
    }

    getPagination(pages) {
        let { filter, count = 0, pageName } = this.props;
		let page = parseInt(filter[ pageName ], 10) || 0;
		pages = parseInt(pages, 10) || 0;

		if (pages < 2)
			return false;

		var limit = 7,
			middle = 4,
			start = 0,
			end = pages,
			i,
			pg = {pages: [], count: count};

		if (page === 0)
			pg.first = 1;
		else
			pg.prev = page - 1;

		if (page === (pages - 1))
			pg.last = 1;
		else
			pg.next = page + 1;

		if (pages <= limit) {
			for (i = 0; i < pages; i++) {
				pg.pages.push({ page: i, label: (i + 1), active: (i === page)});
			}

			return pg;
		}

		start = page - middle;
		end = page + middle;

		if (end - start < limit) {
			start = end - limit;
		}

		if (start < 0) {
			start = 0;
			end = start + limit;
		}

		if (end > pages) {
			end = pages;
			start = end - limit;
			if (start < 0)
				start = 0;
		}

		pg.pages.push({page: 0, label: 1, active: (0 === page)});

		if (pages > limit && page > middle) {
			pg.pages.push({ page: start, label: '...', active: false, delimiter: 1 });
			start++;
		}

		for (i = start + 1; i < end - 1; i++) {
			pg.pages.push({ page: i, label: (i + 1), active: (i === page) });
		}

		if (pages > limit && page < pages - middle) {
			if (i === pages - 2)
				pg.pages.push({ page: i, label: (i + 1), active: (i === page)});
			else
				pg.pages.push({ page: pages - 2, label: '...', active: false, delimiter: 1 });
		}

		pg.pages.push({ page: pages - 1, label: pages, active: (pages - 1 === page)});

		if (pages > limit) {
			if (pg.pages[1].delimiter)
				pg.pages[2].xshid = 1;

			if (pg.pages[pg.pages.length - 2].delimiter)
				pg.pages[pg.pages.length - 3].xshid = 1;
		}

		return pg;
	}

    redirect (page) {
        return () => {
			let { filter, location, pageName } = this.props;
            let newFilter = assign({}, filter);
			newFilter[ pageName ] = page
			if (newFilter[ pageName ] < 0) newFilter[ pageName ] = 0;

			let _redirect = this.props.redirect || redirect;
            _redirect(null, location, newFilter);
        }
    }
    
    render () {
        let { limit = 10, count = 0, filter, className, pageName } = this.props;
        let pages = Math.ceil(count / limit);
        if(pages <= 1) {
            return <div></div>
        }

        let pagination = this.getPagination(pages);
		let toLeft = parseInt(filter[ pageName ]) - 1;
		let toRight = parseInt(filter[ pageName ]) + 1;

        return (
            <Pagination className={ className }>
                <PaginationItem disabled>
                    <PaginationLink href="#" >
                        <span>{ count } total</span>
                    </PaginationLink>
                </PaginationItem>
				{
					pagination.first 
					? 
					""
					:
					<PaginationItem>
						<PaginationLink previous onClick={ this.redirect( toLeft ) } />
					</PaginationItem>
				}
                
                {
                    map(pagination.pages, (page, idx) => {
                        return (
                            <PaginationItem key={ idx } active={ page.active }>
                                <PaginationLink onClick={ this.redirect( page.page ) }>
                                    { page.label }
                                </PaginationLink>
                            </PaginationItem>
                        )
                    })
                }
				{
					pagination.last
					?
					""
					:
					<PaginationItem>
						<PaginationLink next onClick={ this.redirect( toRight ) } />
					</PaginationItem>
				}
                
            </Pagination>
        )
    }
}

Pag.defaultProps = {
	location: "index",
	limit: 10,
	count: 0,
	pageName: "page",
	filter: {
		page: 0
	},
	redirect: null
}

Pag.propTypes = {
	location: PropTypes.string.isRequired,
	limit: PropTypes.number,
	count: PropTypes.number.isRequired,
	filter: PropTypes.object,
	pageName: PropTypes.string,
	redirect: PropTypes.func
}

export default Pag