import { ChangeEvent, FormEvent, RefObject } from 'react';
import styled from 'styled-components';

import { LabelButton, ButtonProps } from '@votingworks/ui';

const LabelButtonContainer = styled(LabelButton)`
  position: relative;

  &:focus-within {
    outline: var(--focus-outline);
  }
`;

const HiddenFileInput = styled.input`
  position: absolute;
  opacity: 0;
  z-index: -1;
  top: 0;
  left: 0;
  width: 0;
  height: 0;
  cursor: pointer;

  &[disabled] {
    cursor: not-allowed;
  }
`;

interface Props {
  accept?: string;
  buttonProps?: Omit<ButtonProps, 'onPress'>;
  disabled?: boolean;
  name?: string;
  multiple?: boolean;
  children: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  innerRef?: RefObject<HTMLInputElement>;
}

export function FileInputButton({
  accept = '*/*',
  buttonProps,
  children,
  disabled,
  onChange,
  innerRef,
  ...rest
}: Props): JSX.Element {
  function onBlur(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    input?.blur();
  }
  return (
    <LabelButtonContainer {...buttonProps}>
      <HiddenFileInput
        {...rest}
        accept={accept}
        disabled={disabled}
        onBlur={onBlur}
        onChange={onChange}
        ref={innerRef}
        type="file"
      />
      {children}
    </LabelButtonContainer>
  );
}
