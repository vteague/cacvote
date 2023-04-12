/* stylelint-disable order/properties-order */
import React from 'react';
import styled from 'styled-components';
import { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCheckCircle,
  faCircleLeft,
  faCircleRight,
  faDeleteLeft,
  faExclamationCircle,
  faExclamationTriangle,
  faGear,
  faInfoCircle,
  faMinusCircle,
  faPencil,
  faTrashCan,
  faXmark,
} from '@fortawesome/free-solid-svg-icons';
import {
  faXmarkCircle,
  faPauseCircle,
} from '@fortawesome/free-regular-svg-icons';

import { Font, FontProps } from './typography';
import { ScreenInfo, useScreenInfo } from './hooks/use_screen_info';

interface InnerProps {
  type: IconDefinition;
}

const StyledSvgIcon = styled.svg`
  fill: currentColor;
  height: 1em;
  width: 1em;
`;

function FaIcon(props: InnerProps): JSX.Element {
  const { type } = props;

  return <FontAwesomeIcon icon={type} />;
}

/**
 * Provides commonly used icons for communicating meaning/context to the user.
 * The VVSG spec recommends using iconography instead of/in addition to any
 * colors.
 */
export const Icons = {
  Backspace(): JSX.Element {
    return <FaIcon type={faDeleteLeft} />;
  },

  Checkmark(): JSX.Element {
    return (
      <StyledSvgIcon
        aria-hidden="true"
        role="img"
        width="100"
        height="100"
        viewBox="0 0 100 100"
      >
        <path d="M89.7038 10.1045C88.2094 8.40006 85.759 8.40006 84.2646 10.1045L39.0198 61.5065L15.719 34.8471C14.2245 33.1364 11.7906 33.1364 10.2852 34.8471L2.12082 44.1186C0.626395 45.8105 0.626395 48.5951 2.12082 50.2996L36.2782 89.3708C37.7727 91.0628 40.2066 91.0628 41.7175 89.3708L97.8627 25.5632C99.3791 23.8587 99.3791 21.0679 97.8627 19.3572L89.7038 10.1045Z" />
      </StyledSvgIcon>
    );
  },

  Closed(): JSX.Element {
    return <FaIcon type={faMinusCircle} />;
  },

  Danger(): JSX.Element {
    return <FaIcon type={faExclamationCircle} />;
  },

  DangerX(): JSX.Element {
    return <FaIcon type={faXmarkCircle} />;
  },

  Delete(): JSX.Element {
    return <FaIcon type={faTrashCan} />;
  },

  Done(): JSX.Element {
    return <FaIcon type={faCheckCircle} />;
  },

  Edit(): JSX.Element {
    return <FaIcon type={faPencil} />;
  },

  Info(): JSX.Element {
    return <FaIcon type={faInfoCircle} />;
  },

  Next(): JSX.Element {
    return <FaIcon type={faCircleRight} />;
  },

  Paused(): JSX.Element {
    return <FaIcon type={faPauseCircle} />;
  },

  Previous(): JSX.Element {
    return <FaIcon type={faCircleLeft} />;
  },

  Settings(): JSX.Element {
    return <FaIcon type={faGear} />;
  },

  Warning(): JSX.Element {
    return <FaIcon type={faExclamationTriangle} />;
  },

  X(): JSX.Element {
    return <FaIcon type={faXmark} />;
  },
} as const;

/** Props for {@link FullScreenIconWrapper}. */
export type FullScreenIconWrapperProps = FontProps;

type FullScreenIconContainerProps = FullScreenIconWrapperProps & {
  screenInfo: ScreenInfo;
};

const FullScreenIconContainer = styled(Font)<FullScreenIconContainerProps>`
  display: block;
  font-size: ${(p) => (p.screenInfo.isPortrait ? '24vw' : '24vh')};
`;

/**
 * Displays the provided child icon at an appropriate full-screen size,
 * depending on screen orientation.
 *
 * Extends the `<Font>` component to support theme-aware accent coloring via the
 * `color` prop.
 *
 * Sample Usage:
 * ```
 * <FullScreenIconWrapper color="success">
 *   <Icons.Checkmark />
 * </FullScreenIconWrapper>
 * ```
 */
export function FullScreenIconWrapper(
  props: FullScreenIconWrapperProps
): JSX.Element {
  const screenInfo = useScreenInfo();

  return <FullScreenIconContainer {...props} screenInfo={screenInfo} />;
}
